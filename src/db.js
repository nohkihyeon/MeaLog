import Dexie from 'dexie';

export const db = new Dexie('MeaLogDB');

db.version(1).stores({
    meals: '++id, date, timestamp'
});
