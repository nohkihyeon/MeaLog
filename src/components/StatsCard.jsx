import React from 'react';
import { Flame, Dumbbell } from 'lucide-react';

const StatsCard = ({ stats }) => {
    return (
        <div className="card" style={{
            padding: '1.5rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '2rem',
            border: '1px solid var(--border-color)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(235, 87, 87, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Flame size={24} color="var(--accent-primary)" />
                </div>
                <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Calories</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.calories} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>kcal</span></p>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(39, 174, 96, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Dumbbell size={24} color="var(--accent-quaternary)" />
                </div>
                <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Protein</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.protein} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>g</span></p>
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
