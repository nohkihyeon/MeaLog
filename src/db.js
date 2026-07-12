import Dexie from 'dexie';

export const db = new Dexie('MeaLogDB');

db.version(1).stores({
    meals: '++id, date, timestamp'
});

// v2: 탄수화물/지방 필드 + 동기화 메타데이터(updatedAt, deleted) 추가.
// Dexie는 기본 키 변경을 지원하지 않으므로 '++id'는 그대로 둔다
// (항상 crypto.randomUUID()를 명시적으로 넣기 때문에 auto-increment는 실제로 동작하지 않음).
// deleted는 IndexedDB가 boolean을 인덱싱하지 못해 0/1을 사용한다.
db.version(2).stores({
    meals: '++id, date, timestamp, updatedAt, deleted'
}).upgrade(tx =>
    tx.table('meals').toCollection().modify(meal => {
        meal.carbs ??= '';
        meal.fat ??= '';
        meal.updatedAt ??= meal.timestamp ?? Date.now();
        meal.deleted ??= 0;
    })
);

// v3: Supabase daily_energy(일별 소모 칼로리) 로컬 캐시.
// 앱에서는 읽기 전용 — 쓰기는 외부(헬스 데이터 업로드 스크립트)에서만 일어나고
// 동기화 시 서버 상태를 그대로 미러링한다. 기본 키는 date(YYYY-MM-DD).
db.version(3).stores({
    meals: '++id, date, timestamp, updatedAt, deleted',
    dailyEnergy: 'date'
});
