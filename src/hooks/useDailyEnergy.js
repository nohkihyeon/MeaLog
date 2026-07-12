import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

// Supabase daily_energy의 로컬 미러(dailyEnergy 테이블) 구독.
// 레코드: { date: 'YYYY-MM-DD', active: number, basal: number, updatedAt }
export const useDailyEnergy = () => {
    return useLiveQuery(() => db.dailyEnergy.toArray(), []) || [];
};
