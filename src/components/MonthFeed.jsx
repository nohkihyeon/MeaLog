import React, { useMemo, useEffect } from 'react';
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

    // Auto-scroll to the selected date
    useEffect(() => {
        // Short timeout to ensure rendering is complete
        const timer = setTimeout(() => {
            const element = document.getElementById(`date-${date}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [date]);

    return (
        <div className="month-feed">
            <h1 className="month-title">
                {monthLabel}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                {daysInMonth.map(dayStr => {
                    // Filter meals for this day and sort by timestamp to keep order stable
                    const dayMeals = meals
                        .filter(m => m.date === dayStr)
                        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    return (
                        <div key={dayStr} id={`date-${dayStr}`}>
                            <DayBlock
                                date={dayStr}
                                meals={dayMeals}
                                allMeals={meals}
                                onUpdateMeal={onUpdateMeal}
                                onDeleteMeal={onDeleteMeal}
                                onAddMeal={onAddMeal}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthFeed;
