import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect } from 'react';
import { scheduleSync } from '../sync';

const STORAGE_KEY = 'eating_record_meals';

export const useMeals = () => {
    // Live Query for real-time updates from IndexedDB (soft-deleted rows excluded)
    const meals = useLiveQuery(
        () => db.meals.where('deleted').equals(0).toArray(),
        []
    ) || [];

    // One-time migration from LocalStorage to Dexie
    useEffect(() => {
        const migrateData = async () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsedMeals = JSON.parse(saved);
                    if (Array.isArray(parsedMeals) && parsedMeals.length > 0) {
                        console.log('Migrating data to IndexedDB...', parsedMeals.length);
                        // Old localStorage records predate the v2 fields, so fill defaults
                        const normalized = parsedMeals.map(m => ({
                            carbs: '',
                            fat: '',
                            updatedAt: m.timestamp ?? Date.now(),
                            deleted: 0,
                            ...m,
                        }));
                        // We use bulkPut to avoid duplicate key errors if ids conflict
                        await db.meals.bulkPut(normalized);

                        // Renaming key to keep a backup just in case
                        localStorage.setItem(STORAGE_KEY + '_backup', saved);
                        localStorage.removeItem(STORAGE_KEY);
                        console.log('Migration successful.');
                    }
                } catch (e) {
                    console.error('Migration failed:', e);
                }
            }
        };
        migrateData();
    }, []);

    const addMeal = async (meal) => {
        await db.meals.put({
            ...meal,
            id: meal.id || crypto.randomUUID(),
            timestamp: Date.now(),
            updatedAt: Date.now(),
            deleted: 0,
        });
        scheduleSync();
    };

    // Soft delete so the deletion itself can propagate to other devices on sync
    const deleteMeal = async (id) => {
        await db.meals.update(id, { deleted: 1, updatedAt: Date.now() });
        scheduleSync();
    };

    const updateMeal = async (id, updates) => {
        await db.meals.update(id, { ...updates, updatedAt: Date.now() });
        scheduleSync();
    };

    const getMealsByDate = (dateStr) => {
        // dateStr format: YYYY-MM-DD
        // Filter in memory for now (efficient enough for personal use)
        return meals.filter((meal) => meal.date === dateStr);
    };

    const getStatsByDate = (dateStr) => {
        const daysMeals = getMealsByDate(dateStr);
        return daysMeals.reduce(
            (acc, meal) => ({
                calories: acc.calories + (Number(meal.calories) || 0),
                protein: acc.protein + (Number(meal.protein) || 0),
                carbs: acc.carbs + (Number(meal.carbs) || 0),
                fat: acc.fat + (Number(meal.fat) || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    };

    return {
        meals,
        addMeal,
        deleteMeal,
        updateMeal,
        getMealsByDate,
        getStatsByDate,
    };
};
