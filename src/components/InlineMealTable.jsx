import React, { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

const MEAL_TYPES = [
    { id: 'breakfast', label: '아침', color: '#2F80ED' },
    { id: 'lunch', label: '점심', color: '#F2C94C' },
    { id: 'dinner', label: '저녁', color: '#27AE60' },
    { id: 'snack', label: '간식', color: '#EB5757' },
    { id: 'healthy', label: '건강식', color: '#56CCF2' },
    { id: 'cheat', label: '치팅데이', color: '#BB6BD9' },
];

const InlineMealTable = ({ meals, onUpdate, onDelete, onAdd }) => {
    // We manage the "next" item's ID in state so we can render it as a stable component
    // before and after it gets added to the list.
    const [nextId, setNextId] = useState(crypto.randomUUID());

    // Refs for tracking focus
    const rowRefs = useRef({});
    const focusTargetRef = useRef(null);

    useEffect(() => {
        if (focusTargetRef.current) {
            const el = rowRefs.current[focusTargetRef.current];
            if (el) {
                const input = el.querySelector('input[name="meal-name"]');
                if (input) {
                    // We only focus if it's not already focused (to avoid jitter?), 
                    // or just force it to ensure continuity.
                    // For IME, forcing focus *might* be risky if it resets cursor.
                    // But since we lost focus (per bug report), we must restore it.
                    input.focus();
                }
            }
            focusTargetRef.current = null;
        }
    }, [meals]);

    // Handler for valid changes in the "Ghost" row
    const handleGhostUpdate = (id, updates) => {
        // Record that we want to keep focus on this ID
        focusTargetRef.current = nextId;

        // If the update has no content (e.g. empty name), we might not want to add it yet?
        // But user expects "Auto-create", so even 1 char adds it.
        // We construct the new meal.
        const newMeal = {
            id: nextId, // Use the stable ID we assigned to the ghost
            name: '',
            calories: '',
            protein: '',
            intake: '',
            type: 'breakfast',
            ...updates
        };

        onAdd(newMeal);
        // Generate a new ID for the *next* ghost row
        setNextId(crypto.randomUUID());
    };

    return (
        <div style={{ width: '100%', fontSize: '0.95rem' }}>
            {/* Header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 2fr) 100px 100px 100px 120px 40px',
                gap: '0',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.5rem',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🍲 음식</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚖️ 칼로리(Kcal)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🔥 단백질(g)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🥣 섭취량(g)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📋 식사 종류</div>
                <div></div>
            </div>

            {/* Existing Rows */}
            {meals.map((meal) => (
                <MealRow
                    key={meal.id}
                    meal={meal}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    ref={el => rowRefs.current[meal.id] = el}
                />
            ))}

            {/* Ghost Row (The "New" input) */}
            {/* It is rendered as a normal MealRow but with a specific key (nextId) */}
            {/* When modified, it promotes itself via handleGhostUpdate */}
            <MealRow
                key={nextId}
                meal={{ id: nextId, name: '', calories: '', protein: '', intake: '', type: 'breakfast' }}
                onUpdate={handleGhostUpdate}
                onDelete={() => { }} // No delete for ghost
                isGhost={true} // Prop to style it slightly differently (e.g. placeholder)
                // We also ref the ghost row so we can find it if needed (though mostly for finding it AFTER promotion)
                ref={el => rowRefs.current[nextId] = el}
            />
        </div>
    );
};

// Sub-component for single row
const MealRow = React.forwardRef(({ meal, onUpdate, onDelete, isGhost }, ref) => {
    const [isHovered, setIsHovered] = useState(false);

    const getTypeLabel = (id) => MEAL_TYPES.find(t => t.id === id) || { label: id, color: '#888' };
    const typeObj = getTypeLabel(meal.type);

    return (
        <div
            ref={ref}
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 2fr) 100px 100px 100px 120px 40px',
                gap: '0',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border-color)',
                alignItems: 'center',
                opacity: isGhost ? 0.6 : 1
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '1rem' }}>
                <div style={{ width: '1.2rem' }}></div>
                <input
                    name="meal-name"
                    value={meal.name}
                    placeholder={isGhost ? "New" : ""}
                    onChange={e => onUpdate(meal.id, { name: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    value={meal.calories}
                    onChange={e => onUpdate(meal.id, { calories: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    value={meal.protein}
                    onChange={e => onUpdate(meal.id, { protein: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    value={meal.intake || ''}
                    onChange={e => onUpdate(meal.id, { intake: e.target.value })}
                    placeholder=""
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '0.5rem' }}>
                <select
                    value={meal.type}
                    onChange={e => onUpdate(meal.id, { type: e.target.value })}
                    style={{
                        border: 'none',
                        width: '100%',
                        outline: 'none',
                        fontSize: '0.8rem',
                        appearance: 'none',
                        backgroundColor: typeObj.color,
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textAlign: 'center',
                        cursor: 'pointer'
                    }}
                >
                    {MEAL_TYPES.map(t => <option key={t.id} value={t.id} style={{ color: 'black', backgroundColor: 'white' }}>{t.label}</option>)}
                </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                {!isGhost && isHovered && (
                    <button onClick={() => onDelete(meal.id)} style={{ color: 'var(--text-tertiary)' }}>
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
});

export default InlineMealTable;
