import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const MEAL_TYPES = [
    { id: 'breakfast', label: 'Breakfast', color: 'var(--accent-secondary)' },
    { id: 'lunch', label: 'Lunch', color: 'var(--accent-tertiary)' },
    { id: 'dinner', label: 'Dinner', color: 'var(--accent-quaternary)' },
    { id: 'snack', label: 'Snack', color: '#9B51E0' },
];

const AddMealModal = ({ isOpen, onClose, onSave, date }) => {
    const [formData, setFormData] = useState({
        name: '',
        calories: '',
        protein: '',
        type: 'breakfast',
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            date,
            calories: Number(formData.calories),
            protein: Number(formData.protein),
        });
        setFormData({ name: '', calories: '', protein: '', type: 'breakfast' });
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem' // For mobile safety
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '1.5rem',
                border: '1px solid var(--border-color)',
                backgroundColor: '#1E1E1E'
            }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem' }}>Add Meal</h2>
                    <button onClick={onClose}><X size={24} color="var(--text-secondary)" /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Food Name</label>
                        <input
                            required
                            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Grilled Chicken Breast"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Calories (kcal)</label>
                            <input
                                type="number"
                                required
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                                value={formData.calories}
                                onChange={e => setFormData({ ...formData, calories: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Protein (g)</label>
                            <input
                                type="number"
                                required
                                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                                value={formData.protein}
                                onChange={e => setFormData({ ...formData, protein: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Meal Type</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {MEAL_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: type.id })}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '20px',
                                        fontSize: '0.875rem',
                                        border: formData.type === type.id ? `1px solid ${type.color}` : '1px solid var(--border-color)',
                                        backgroundColor: formData.type === type.id ? `${type.color}20` : 'transparent',
                                        color: formData.type === type.id ? type.color : 'var(--text-secondary)',
                                        fontWeight: formData.type === type.id ? 600 : 400,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            marginTop: '1rem',
                            backgroundColor: 'var(--text-primary)',
                            color: 'var(--bg-primary)',
                            padding: '0.875rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} />
                        Add Meal
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddMealModal;
