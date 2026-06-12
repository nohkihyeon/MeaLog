import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import SyncStatus from './SyncStatus';

const Sidebar = ({ selectedDate, onSelectDate }) => {
    const currentYear = new Date(selectedDate).getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const [isYearOpen, setIsYearOpen] = useState(true);

    const handleMonthClick = (month) => {
        // Select the 1st day of the clicked month
        const newDate = new Date(currentYear, month - 1, 1);
        const yearStr = newDate.getFullYear();
        const monthStr = String(newDate.getMonth() + 1).padStart(2, '0');
        const dayStr = '01';

        onSelectDate(`${yearStr}-${monthStr}-${dayStr}`);
    };

    return (
        <aside className="app-sidebar">
            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <div style={{
                    width: '20px', height: '20px', backgroundColor: '#EB5757', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                }}>🍎</div>
                <span>MeaLog</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{
                        padding: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <span>YEARS</span>
                    </div>

                    <div>
                        <div
                            onClick={() => setIsYearOpen(!isYearOpen)}
                            style={{
                                padding: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-tertiary)',
                                userSelect: 'none'
                            }}
                        >
                            {isYearOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <FileText size={14} />
                            <span>2026 MeaLog</span>
                        </div>

                        {isYearOpen && (
                            <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                                {months.map(month => {
                                    const isSelected = new Date(selectedDate).getMonth() + 1 === month;
                                    return (
                                        <div
                                            key={month}
                                            onClick={() => handleMonthClick(month)}
                                            style={{
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.9rem',
                                                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                marginBottom: '2px',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem'
                                            }}
                                            onMouseOver={e => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                                            onMouseOut={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            {month}월
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
