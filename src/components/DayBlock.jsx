import React from 'react';
import InlineMealTable from './InlineMealTable';

const DayBlock = ({ date, meals, allMeals, onUpdateMeal, onDeleteMeal, onAddMeal }) => {
    const dayNum = new Date(date).getDate();

    // Calculate Summaries
    const sums = meals.reduce((acc, meal) => ({
        calories: acc.calories + (Number(meal.calories) || 0),
        protein: acc.protein + (Number(meal.protein) || 0),
    }), { calories: 0, protein: 0 });

    return (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{dayNum}일</h2>
            </div>

            <InlineMealTable
                meals={meals}
                allMeals={allMeals}
                onUpdate={onUpdateMeal}
                onDelete={onDeleteMeal}
                onAdd={(meal) => onAddMeal({ ...meal, date })}
            />

            <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem 0',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 500,
                gap: '2rem'
            }}>
                <span>칼로리 합 {sums.calories} kcal</span>
                <span>단백질 합 {sums.protein} g</span>
            </div>
        </div>
    );
};

export default DayBlock;
