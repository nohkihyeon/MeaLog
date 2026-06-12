import React from 'react';
import { Flame, Dumbbell, Wheat, Droplet } from 'lucide-react';

const STAT_ITEMS = [
    { key: 'calories', label: 'Calories', unit: 'kcal', Icon: Flame, color: 'var(--accent-primary)', bg: 'rgba(235, 87, 87, 0.15)' },
    { key: 'protein', label: 'Protein', unit: 'g', Icon: Dumbbell, color: 'var(--accent-quaternary)', bg: 'rgba(39, 174, 96, 0.15)' },
    { key: 'carbs', label: 'Carbs', unit: 'g', Icon: Wheat, color: 'var(--accent-tertiary)', bg: 'rgba(242, 201, 76, 0.15)' },
    { key: 'fat', label: 'Fat', unit: 'g', Icon: Droplet, color: 'var(--accent-secondary)', bg: 'rgba(45, 156, 219, 0.15)' },
];

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
            {STAT_ITEMS.map(({ key, label, unit, Icon, color, bg }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Icon size={24} color={color} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{label}</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                            {stats[key] ?? 0} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>{unit}</span>
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StatsCard;
