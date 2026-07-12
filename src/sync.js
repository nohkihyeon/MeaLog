import { createClient } from '@supabase/supabase-js';
import { db } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// .env가 없으면 동기화 전체가 비활성화되고 앱은 기존처럼 로컬 전용으로 동작한다.
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const isSyncConfigured = () => !!supabase;

const LAST_PUSH_KEY = 'mealog_last_push'; // 마지막으로 push한 로컬 updatedAt (ms)
const LAST_PULL_KEY = 'mealog_last_pull'; // 마지막으로 pull한 서버 server_updated_at (ISO)
const PULL_PAGE_SIZE = 1000;

// --- 동기화 상태 미니 스토어 (useSyncExternalStore 구독용) ---
// status: disabled | logged_out | idle | syncing | error
let state = {
    status: supabase ? 'logged_out' : 'disabled',
    lastSyncAt: null,
    error: null,
    user: null,
};
const listeners = new Set();

const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
};

export const getSyncState = () => state;
export const subscribeSyncState = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// --- 인증 ---
export async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
}

export async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

const OWNER_KEY = 'mealog_owner_user_id'; // 이 기기의 로컬 DB가 누구 데이터인지 기록

if (supabase) {
    // INITIAL_SESSION 이벤트도 여기로 들어오므로, 로그인 상태로 앱을 켜면 즉시 1회 동기화된다
    supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null;
        setState({ user, status: user ? 'idle' : 'logged_out' });
        if (!user) return; // 로그아웃 시 로컬 데이터는 보존 (같은 사람이 다시 로그인하는 경우가 대부분)

        const prevOwner = localStorage.getItem(OWNER_KEY);
        if (prevOwner && prevOwner !== user.id) {
            // 같은 브라우저에서 다른 계정으로 전환 — 이전 계정의 로컬 데이터가
            // 새 계정으로 push되거나 화면에 섞이지 않도록 로컬을 비우고 새로 pull한다
            localStorage.removeItem(LAST_PUSH_KEY);
            localStorage.removeItem(LAST_PULL_KEY);
            localStorage.setItem(OWNER_KEY, user.id);
            Promise.all([db.meals.clear(), db.dailyEnergy.clear()]).then(() => scheduleSync(0));
            return;
        }
        localStorage.setItem(OWNER_KEY, user.id);
        scheduleSync(0);
    });
}

// --- Dexie ↔ Supabase 레코드 변환 ---
const num = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const toRow = (m) => ({
    id: m.id,
    date: m.date,
    type: m.type || 'breakfast',
    name: m.name ?? '',
    calories: num(m.calories),
    protein: num(m.protein),
    carbs: num(m.carbs),
    fat: num(m.fat),
    intake: m.intake == null ? '' : String(m.intake),
    updated_at_ms: m.updatedAt ?? m.timestamp ?? 0,
    deleted: !!m.deleted,
});

const toMeal = (row, local) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    name: row.name ?? '',
    calories: row.calories ?? '',
    protein: row.protein ?? '',
    carbs: row.carbs ?? '',
    fat: row.fat ?? '',
    intake: row.intake ?? '',
    timestamp: local?.timestamp ?? row.updated_at_ms,
    updatedAt: row.updated_at_ms,
    deleted: row.deleted ? 1 : 0,
});

// --- 동기화 본체: Last-Write-Wins (updatedAt 기준) ---
async function pushChanges() {
    const lastPush = Number(localStorage.getItem(LAST_PUSH_KEY) || 0);
    const dirty = await db.meals.where('updatedAt').above(lastPush).toArray();
    if (!dirty.length) return;

    const { error } = await supabase.from('meals').upsert(dirty.map(toRow));
    if (error) throw error;
    localStorage.setItem(LAST_PUSH_KEY, String(Math.max(...dirty.map(m => m.updatedAt || 0))));
}

async function pullChanges() {
    // pull 커서는 서버 시계(server_updated_at) 기준이라 기기 간 시계 오차로 변경분을 놓치지 않는다.
    // 충돌 판정(LWW)만 클라이언트 updatedAt(updated_at_ms)으로 한다.
    let since = localStorage.getItem(LAST_PULL_KEY) || '1970-01-01T00:00:00Z';
    for (;;) {
        const { data, error } = await supabase
            .from('meals')
            .select('*')
            .gt('server_updated_at', since)
            .order('server_updated_at', { ascending: true })
            .limit(PULL_PAGE_SIZE);
        if (error) throw error;
        if (!data?.length) break;

        await db.transaction('rw', db.meals, async () => {
            for (const row of data) {
                const local = await db.meals.get(row.id);
                if (!local || (row.updated_at_ms || 0) > (local.updatedAt || 0)) {
                    await db.meals.put(toMeal(row, local));
                }
            }
        });

        since = data[data.length - 1].server_updated_at;
        localStorage.setItem(LAST_PULL_KEY, since);
        if (data.length < PULL_PAGE_SIZE) break;
    }
}

// daily_energy(일별 소모 칼로리)는 앱에서 수정하지 않는 읽기 전용 데이터라
// 커서 없이 전체를 받아 로컬 테이블을 서버 상태로 통째로 미러링한다.
// (1년치 ≈ 365행, 페이지당 1000행이면 충분. 삭제 전파도 자동 해결)
async function pullDailyEnergy() {
    const rows = [];
    for (let from = 0; ; from += PULL_PAGE_SIZE) {
        const { data, error } = await supabase
            .from('daily_energy')
            .select('date, active_calories, basal_calories, updated_at')
            .order('date', { ascending: true })
            .range(from, from + PULL_PAGE_SIZE - 1);
        if (error) {
            // 테이블이 아직 없는 프로젝트에서도 meals 동기화는 계속 동작해야 한다
            if (error.code === '42P01') return;
            throw error;
        }
        if (data?.length) rows.push(...data);
        if (!data || data.length < PULL_PAGE_SIZE) break;
    }

    await db.transaction('rw', db.dailyEnergy, async () => {
        await db.dailyEnergy.clear();
        await db.dailyEnergy.bulkAdd(rows.map(r => ({
            date: r.date,
            active: Number(r.active_calories) || 0,
            basal: Number(r.basal_calories) || 0,
            updatedAt: r.updated_at,
        })));
    });
}

let syncing = false;
let pendingResync = false;

export async function fullSync() {
    if (!supabase || !navigator.onLine) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (syncing) {
        pendingResync = true;
        return;
    }
    syncing = true;
    setState({ status: 'syncing', error: null });
    try {
        await pullChanges();
        await pushChanges();
        await pullDailyEnergy();
        setState({ status: 'idle', lastSyncAt: Date.now(), error: null });
    } catch (e) {
        console.error('Sync failed:', e);
        setState({ status: 'error', error: e.message || String(e) });
    } finally {
        syncing = false;
        if (pendingResync) {
            pendingResync = false;
            scheduleSync(500);
        }
    }
}

// 쓰기 직후 호출용 debounce — 연속 타이핑이 끝나고 한 번만 동기화
let syncTimer = null;
export function scheduleSync(delay = 3000) {
    if (!supabase) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(fullSync, delay);
}
