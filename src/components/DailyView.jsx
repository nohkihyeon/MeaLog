import React from 'react';
import { Trash2, Coffee, Sun, Moon, Utensils } from 'lucide-react';

const MEAL_Icons = {
    breakfast: Coffee,
    lunch: Sun,
    dinner: Moon,
    snack: Utensils,
};

const MEAL_COLORS = {
    breakfast: 'var(--accent-secondary)',
    lunch: 'var(--accent-tertiary)',
    dinner: 'var(--accent-quaternary)',
    snack: '#9B51E0',
};

const DailyView = ({ meals, onDelete }) => {
    if (meals.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px'
            }}>
                <p>No meals recorded for today.</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Click "Add Meal" to start tracking.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {meals.map((meal) => {
                const Icon = MEAL_Icons[meal.type] || Utensils;
                const color = MEAL_COLORS[meal.type] || 'var(--text-secondary)';

                return (
                    <div key={meal.id} className="card" style={{
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-color)',
                        transition: 'transform 0.1s',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)'
                            }}>
                                <Icon size={20} />
                            </div>

                            <div>
                                <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{meal.name}</p>
                                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span>{meal.calories} kcal</span>
                                    <span>•</span>
                                    <span>{meal.protein}g protein</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                backgroundColor: `${color}20`,
                                color: color,
                                fontWeight: 600,
                                textTransform: 'capitalize'
                            }}>
                                {meal.type}
                            </span>

                            <button
                                onClick={() => onDelete(meal.id)}
                                style={{
                                    padding: '0.5rem',
                                    color: 'var(--text-tertiary)',
                                    opacity: 0.6,
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DailyView;
