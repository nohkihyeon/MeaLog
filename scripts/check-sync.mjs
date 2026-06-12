// 일회성 Supabase 설정 검증 스크립트 — 실행 후 삭제됨
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.log('ENV CHECK: FAIL - .env에 값이 없습니다');
    process.exit(1);
}
console.log('ENV CHECK: OK -', env.VITE_SUPABASE_URL);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// 1. meals 테이블과 모든 컬럼이 존재하는지 (스키마 SQL이 실행됐는지)
const { data, error } = await supabase
    .from('meals')
    .select('id, date, type, name, calories, protein, carbs, fat, intake, updated_at_ms, server_updated_at, deleted')
    .limit(1);
console.log('TABLE CHECK:', error ? `FAIL - ${error.message}` : `OK - 테이블/컬럼 모두 존재 (익명에게 보이는 행: ${data.length}개)`);

// 2. RLS: 로그인 없이 insert가 거부되어야 정상
const { error: insErr } = await supabase.from('meals').insert({
    id: crypto.randomUUID(),
    date: '2026-01-01',
    type: 'snack',
    name: 'rls-test',
    updated_at_ms: 1,
});
console.log('RLS CHECK:', insErr
    ? `OK - 익명 쓰기 차단됨 (${insErr.message})`
    : 'FAIL - 익명 insert가 허용됨! RLS 설정을 확인하세요');

// 3. Auth API가 살아있는지 (틀린 비밀번호로 시도 → "Invalid login credentials"가 나오면 정상)
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'connectivity-test@example.com',
    password: 'wrong-password-on-purpose',
});
console.log('AUTH CHECK:', authErr
    ? (authErr.message.includes('Invalid login credentials')
        ? 'OK - Auth 엔드포인트 정상 응답'
        : `확인 필요 - ${authErr.message}`)
    : 'FAIL - 테스트 계정으로 로그인이 됨(?)');
