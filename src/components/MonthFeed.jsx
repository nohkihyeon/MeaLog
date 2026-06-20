import React, { useMemo, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import DayBlock from './DayBlock';

const MonthFeed = ({ date, meals, onUpdateMeal, onDeleteMeal, onAddMeal, onGoToToday }) => {
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

    const handleGoToToday = () => {
        if (onGoToToday) onGoToToday();
        // date 값이 이미 오늘이어서 위 useEffect가 다시 동작하지 않는 경우에도
        // 오늘 날짜로 스크롤되도록 직접 한 번 더 호출
        const t = new Date();
        const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        setTimeout(() => {
            const el = document.getElementById(`date-${todayStr}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    };

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

            <button
                onClick={handleGoToToday}
                aria-label="오늘로 가기"
                title="오늘로 가기"
                style={{
                    position: 'fixed',
                    right: '1.5rem',
                    bottom: '1.5rem',
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: '#EB5757',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}
            >
                <CalendarDays size={16} />
                <span>오늘</span>
            </button>
        </div>
    );
};

export default MonthFeed;
