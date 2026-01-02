import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

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
        <aside style={{
            width: '240px',
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 0
        }}>
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

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27AE60' }}></div>
                    Online
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
