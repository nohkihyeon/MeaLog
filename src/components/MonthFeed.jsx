import React, { useMemo, useEffect, useRef } from 'react';
import DayBlock from './DayBlock';

const MonthFeed = ({ date, meals, onUpdateMeal, onDeleteMeal, onAddMeal }) => {
    const year = new Date(date).getFullYear();
    const month = new Date(date).getMonth(); // 0-indexed

    // Create array of days in the month
    const daysInMonth = useMemo(() => {
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => {
            const dayNum = i + 1;
            // Format: YYYY-MM-DD
            return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        });
    }, [year, month]);

    const monthLabel = `${month + 1}월`;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 2rem' }}>
            <h1 style={{
                fontSize: '3rem',
                fontWeight: 700,
                marginBottom: '2rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1rem'
            }}>
                {monthLabel}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                {daysInMonth.map(dayStr => {
                    // Filter meals for this day and sort by timestamp to keep order stable
                    const dayMeals = meals
                        .filter(m => m.date === dayStr)
                        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    return (
                        <DayBlock
                            key={dayStr}
                            date={dayStr}
                            meals={dayMeals}
                            allMeals={meals}
                            onUpdateMeal={onUpdateMeal}
                            onDeleteMeal={onDeleteMeal}
                            onAddMeal={onAddMeal}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default MonthFeed;
