import React, { useState } from 'react';
import { BarChart2, CalendarDays } from 'lucide-react';
import SyncStatus from './SyncStatus';

const Sidebar = ({ selectedDate, onSelectDate, currentView, onChangeView, onTriggerEasterEgg }) => {
    const currentYear = new Date(selectedDate).getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const [clickCount, setClickCount] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);

    const handleLogoClick = () => {
        const now = Date.now();
        if (now - lastClickTime > 2000) {
            setClickCount(1);
        } else {
            const next = clickCount + 1;
            if (next >= 5) {
                if (onTriggerEasterEgg) onTriggerEasterEgg();
                setClickCount(0);
            } else {
                setClickCount(next);
            }
        }
        setLastClickTime(now);
    };

    const handleMonthClick = (month) => {
        // Select the 1st day of the clicked month
        const newDate = new Date(currentYear, month - 1, 1);
        const yearStr = newDate.getFullYear();
        const monthStr = String(newDate.getMonth() + 1).padStart(2, '0');
        const dayStr = '01';

        onSelectDate(`${yearStr}-${monthStr}-${dayStr}`);
        if (onChangeView) onChangeView('feed');
    };

    return (
        <aside className="app-sidebar">
            <div 
                onClick={handleLogoClick}
                style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
            >
                <div style={{
                    width: '20px', height: '20px', backgroundColor: '#EB5757', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                }}>🍎</div>
                <span>MeaLog</span>
            </div>

            {/* 메인 네비게이션 */}
            <div style={{ padding: '0 0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)' }}>
                <div
                    onClick={() => onChangeView('feed')}
                    style={{
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: currentView === 'feed' ? 'rgba(255,255,255,0.05)' : 'transparent',
                        color: currentView === 'feed' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => currentView !== 'feed' && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                    onMouseOut={e => currentView !== 'feed' && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    <CalendarDays size={15} color={currentView === 'feed' ? '#EB5757' : 'var(--text-secondary)'} />
                    <span>식단 피드</span>
                </div>
                <div
                    onClick={() => onChangeView('stats')}
                    style={{
                        padding: '0.5rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        backgroundColor: currentView === 'stats' ? 'rgba(255,255,255,0.05)' : 'transparent',
                        color: currentView === 'stats' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => currentView !== 'stats' && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                    onMouseOut={e => currentView !== 'stats' && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    <BarChart2 size={15} color={currentView === 'stats' ? '#27AE60' : 'var(--text-secondary)'} />
                    <span>통계 리포트</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.5rem 0' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.05em'
                    }}>
                        2026 식단 내역
                    </div>

                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '6px', 
                        padding: '0.25rem 0.5rem' 
                    }}>
                        {months.map(month => {
                            const isSelected = new Date(selectedDate).getMonth() + 1 === month;
                            return (
                                <div
                                    key={month}
                                    onClick={() => handleMonthClick(month)}
                                    style={{
                                        padding: '0.5rem 0.25rem',
                                        fontSize: '0.8rem',
                                        fontWeight: isSelected ? '600' : '400',
                                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        border: isSelected ? '1px solid var(--border-color)' : '1px solid transparent',
                                        transition: 'all 0.15s ease',
                                        userSelect: 'none'
                                    }}
                                    onMouseOver={e => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                                    onMouseOut={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    {month}월
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SyncStatus />
                <div
                    onClick={async () => {
                        try {
                            // Dynamic import to avoid circular dependencies if any, though here it's fine
                            const { db } = await import('../db');
                            const allMeals = await db.meals.toArray();
                            const dataStr = JSON.stringify(allMeals, null, 2);
                            const blob = new Blob([dataStr], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `mealog_backup_${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } catch (e) {
                            console.error('Export failed', e);
                            alert('Export failed');
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27AE60' }}></div>
                    <span>Backup Data (JSON)</span>
                </div>

                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                }}>
                    <input
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = ''; // 같은 파일을 다시 선택해도 onChange가 뜨도록
                            if (!file) return;
                            try {
                                const records = JSON.parse(await file.text());
                                if (!Array.isArray(records)) throw new Error('백업 JSON 형식이 아닙니다');

                                const { db } = await import('../db');
                                const { scheduleSync } = await import('../sync');
                                const now = Date.now();
                                const meals = records
                                    .filter(m => m.id && m.date)
                                    .map(m => ({
                                        carbs: '',
                                        fat: '',
                                        intake: '',
                                        ...m,
                                        // 가져온 데이터가 동기화 push 대상이 되도록 현재 시각으로 갱신
                                        updatedAt: now,
                                        deleted: m.deleted ? 1 : 0,
                                    }));
                                await db.meals.bulkPut(meals);
                                scheduleSync(500);
                                alert(`${meals.length}개 식단을 가져왔습니다. 로그인 상태면 곧 클라우드로 동기화됩니다.`);
                            } catch (err) {
                                console.error('Import failed', err);
                                alert('가져오기 실패: ' + err.message);
                            }
                        }}
                    />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2D9CDB' }}></div>
                    <span>Import Data (JSON)</span>
                </label>
            </div>
        </aside>
    );
};

export default Sidebar;
