// Gemini API 프록시 (Supabase Edge Function)
// API 키는 Supabase secret(GEMINI_API_KEY)에만 두고 브라우저 번들에는 넣지 않는다.
// 로그인한 사용자만 호출 가능. ALLOWED_EMAILS(쉼표 구분)를 설정하면 그 계정만 허용.
//
// 배포:
//   npx supabase secrets set GEMINI_API_KEY=<키> --project-ref <ref>
//   npx supabase functions deploy gemini --project-ref <ref>

import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const ALLOWED_EMAILS = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
    if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY secret이 설정되지 않았습니다.' }, 500);

    // 요청자의 세션 토큰으로 로그인 사용자 확인
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
    if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes((user.email ?? '').toLowerCase())) {
        return json({ error: '허용되지 않은 계정입니다.' }, 403);
    }

    const { model, body } = await req.json().catch(() => ({}));
    if (typeof model !== 'string' || !/^gemini-[\w.-]+$/.test(model) || !body) {
        return json({ error: '잘못된 요청입니다.' }, 422);
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
            body: JSON.stringify(body),
        },
    );
    // 상태 코드를 그대로 넘겨서 클라이언트의 모델 폴백(400/404/429)이 똑같이 동작하게 한다
    return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
