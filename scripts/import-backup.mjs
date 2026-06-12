// 백업 JSON을 Supabase meals 테이블로 업로드한다.
// 사용법: node scripts/import-backup.mjs [백업파일.json]
// 필요: .env에 아래 두 줄 추가 (가져오기가 끝나면 지워도 됨)
//   MEALOG_SYNC_EMAIL=<앱 로그인 이메일>
//   MEALOG_SYNC_PASSWORD=<앱 로그인 비밀번호>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

if (!env.MEALOG_SYNC_EMAIL || !env.MEALOG_SYNC_PASSWORD) {
    console.error('.env에 MEALOG_SYNC_EMAIL / MEALOG_SYNC_PASSWORD를 추가해 주세요.');
    process.exit(1);
}

const file = process.argv[2] || 'mealog_backup_2026-06-12.json';
const records = JSON.parse(readFileSync(file, 'utf8'));
console.log(`${file}: ${records.length}개 레코드 읽음`);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.MEALOG_SYNC_EMAIL,
    password: env.MEALOG_SYNC_PASSWORD,
});
if (authErr) {
    console.error('로그인 실패:', authErr.message);
    process.exit(1);
}

const num = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const rows = records
    .filter(m => m.id && m.date)
    .map(m => ({
        id: m.id,
        date: m.date,
        type: m.type || 'breakfast',
        name: m.name ?? '',
        calories: num(m.calories),
        protein: num(m.protein),
        carbs: num(m.carbs),
        fat: num(m.fat),
        intake: m.intake == null ? '' : String(m.intake),
        // 백업 시점의 timestamp를 LWW 기준으로 사용 — 이후 앱에서 수정한 내용이 항상 이긴다
        updated_at_ms: m.updatedAt ?? m.timestamp ?? 0,
        deleted: !!m.deleted,
    }));

for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('meals').upsert(batch);
    if (error) {
        console.error('업로드 실패:', error.message);
        process.exit(1);
    }
    console.log(`${Math.min(i + 500, rows.length)}/${rows.length} 업로드 완료`);
}

const { count, error: cntErr } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true });
console.log(cntErr ? `완료 (총 개수 확인 실패: ${cntErr.message})` : `완료. 서버에 총 ${count}개 레코드 존재`);

await supabase.auth.signOut();
