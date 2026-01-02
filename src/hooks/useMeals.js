import { useState, useEffect } from 'react';

const STORAGE_KEY = 'eating_record_meals';

export const useMeals = () => {
    const [meals, setMeals] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
    }, [meals]);

    const addMeal = (meal) => {
        const newMeal = {
            ...meal,
            id: meal.id || crypto.randomUUID(),
            timestamp: Date.now(),
        };
        setMeals((prev) => [...prev, newMeal]);
    };

    const deleteMeal = (id) => {
        setMeals((prev) => prev.filter((meal) => meal.id !== id));
    };

    const updateMeal = (id, updates) => {
        setMeals((prev) => prev.map(meal =>
            meal.id === id ? { ...meal, ...updates } : meal
        ));
    };

    const getMealsByDate = (dateStr) => {
        // dateStr format: YYYY-MM-DD
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
