import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useEffect } from 'react';

const STORAGE_KEY = 'eating_record_meals';

export const useMeals = () => {
    // Live Query for real-time updates from IndexedDB
    const meals = useLiveQuery(() => db.meals.toArray(), []) || [];

    // One-time migration from LocalStorage to Dexie
    useEffect(() => {
        const migrateData = async () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsedMeals = JSON.parse(saved);
                    if (Array.isArray(parsedMeals) && parsedMeals.length > 0) {
                        console.log('Migrating data to IndexedDB...', parsedMeals.length);
                        // Bulk add to Dexie
                        // We use bulkPut to avoid duplicate key errors if ids conflict
                        await db.meals.bulkPut(parsedMeals);

                        // Clear localStorage after successful migration
                        // localStorage.removeItem(STORAGE_KEY); 
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
        const newMeal = {
            ...meal,
            id: meal.id || crypto.randomUUID(),
            timestamp: Date.now(),
        };
        await db.meals.add(newMeal);
    };

    const deleteMeal = async (id) => {
        await db.meals.delete(id);
    };

    const updateMeal = async (id, updates) => {
        await db.meals.update(id, updates);
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
            }),
            { calories: 0, protein: 0 }
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
