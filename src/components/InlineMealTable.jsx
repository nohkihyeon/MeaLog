import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';

const MEAL_TYPES = [
    { id: 'breakfast', label: '아침', color: '#2F80ED' },
    { id: 'lunch', label: '점심', color: '#F2C94C' },
    { id: 'dinner', label: '저녁', color: '#27AE60' },
    { id: 'snack', label: '간식', color: '#EB5757' },
    { id: 'healthy', label: '건강식', color: '#56CCF2' },
    { id: 'cheat', label: '치팅데이', color: '#BB6BD9' },
];

const InlineMealTable = ({ meals, allMeals = [], onUpdate, onDelete, onAdd }) => {
    // We manage the "next" item's ID in state so we can render it as a stable component
    // before and after it gets added to the list.
    const [nextId, setNextId] = useState(crypto.randomUUID());

    // Optimistic state to prevent UI jitter/disappearance during async DB updates.
    // Maps ID -> Full Meal Object
    const [overrides, setOverrides] = useState({});

    // Refs for tracking focus
    const rowRefs = useRef({});
    const focusTargetRef = useRef(null);

    // Ref to prevent race conditions where rapid IME input triggers multiple "adds" for the same ID
    const promotedIds = useRef(new Set());

    // Merge props.meals with local overrides AND the ghost row into one stable list
    const itemsToRender = useMemo(() => {
        const result = [];
        const seenIds = new Set();

        // 1. Process existing meals (applying overrides if any)
        meals.forEach(meal => {
            seenIds.add(meal.id);
            if (overrides[meal.id]) {
                result.push(overrides[meal.id]);
            } else {
                result.push(meal);
            }
        });

        // 2. Add new meals from overrides that aren't in props.meals yet
        Object.values(overrides).forEach(meal => {
            if (!seenIds.has(meal.id)) {
                result.push(meal);
                seenIds.add(meal.id);
            }
        });

        // 3. Determine default type from the last real meal
        const lastMeal = result[result.length - 1];
        const defaultType = lastMeal ? lastMeal.type : 'breakfast';

        // 4. Always append the "Ghost" row at the end
        // key must be stable (nextId)
        result.push({
            id: nextId,
            name: '',
            calories: '',
            protein: '',
            intake: '',
            type: defaultType,
            isGhost: true
        });

        return result;
    }, [meals, overrides, nextId]);

    // Cleanup overrides when DB catches up
    useEffect(() => {
        setOverrides(prev => {
            const next = { ...prev };
            let changed = false;

            Object.keys(next).forEach(id => {
                const unsaved = next[id];
                const saved = meals.find(m => m.id === id);

                // If the meal exists in DB and matches our local state, we can drop the override
                if (saved) {
                    const isSynced =
                        saved.name === unsaved.name &&
                        String(saved.calories) === String(unsaved.calories || '') &&
                        String(saved.protein) === String(unsaved.protein || '') &&
                        String(saved.intake) === String(unsaved.intake || '') &&
                        saved.type === unsaved.type;

                    if (isSynced) {
                        delete next[id];
                        changed = true;
                    }
                }
            });

            return changed ? next : prev;
        });
    }, [meals]);

    useEffect(() => {
        if (focusTargetRef.current) {
            const el = rowRefs.current[focusTargetRef.current];
            if (el) {
                const input = el.querySelector('input[name="meal-name"]');
                // Vital Fix for IME: Only focus if NOT already focused.
                // Re-focusing interrupts composition.
                if (input && document.activeElement !== input) {
                    input.focus();
                }
            }
            focusTargetRef.current = null;
        }
    }, [nextId]); // Run ONLY when a new row is prepared (meaning the previous one was promoted)

    // Handler for valid changes in the "Ghost" row
    const handleGhostUpdate = (id, updates) => {
        // Record that we want to keep focus on this ID
        focusTargetRef.current = nextId;

        // If this ID has already been promoted to "Real", we should treat this as an UPDATE, not an ADD.
        // This captures the race condition where the second character of an IME composition arrives 
        // before the state update has fully cycled the component from Ghost -> Real.
        if (promotedIds.current.has(id)) {
            handleRowUpdate(id, updates);
            return;
        }

        // Find current default type again (safest way to ensure consistency)
        // We can inspect the ghost row in itemsToRender to see what it was showing
        const ghostRow = itemsToRender.find(i => i.id === nextId);
        const currentType = ghostRow ? ghostRow.type : 'breakfast';

        const newMeal = {
            id: nextId,
            name: '',
            calories: '',
            protein: '',
            intake: '',
            type: currentType, // Inherit what was shown
            ...updates,
            isGhost: false // No longer ghost once touched
        };

        // Mark as promoted immediately
        promotedIds.current.add(id);

        // 1. Optimistic Update
        setOverrides(prev => ({ ...prev, [newMeal.id]: newMeal }));

        // 2. Trigger DB Update
        onAdd(newMeal);

        // 3. Prepare for next entry
        setNextId(crypto.randomUUID());
    };

    const handleRowUpdate = (id, updates) => {
        const item = itemsToRender.find(m => m.id === id);

        // Safety check: if modifying the ghost row via this handler (unlikely but possible), divert it
        if (item && item.isGhost) {
            handleGhostUpdate(id, updates);
            return;
        }

        // 1. Optimistic Update
        setOverrides(prev => {
            if (!item) return prev;
            return {
                ...prev,
                [id]: { ...item, ...updates }
            };
        });

        // 2. Trigger DB Update
        onUpdate(id, updates);
    };

    // 5. Gather unique recommendations from all history
    const recommendations = useMemo(() => {
        const sourceMeals = allMeals.length > 0 ? allMeals : meals;
        const map = new Map();
        // Sort by timestamp descending to get the most recent values for each name
        [...sourceMeals].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(m => {
            // Only consider meals that have at least some nutritional data or non-empty intake
            const hasData = m.calories || m.protein || m.intake;
            if (m.name && hasData && !map.has(m.name)) {
                map.set(m.name, {
                    name: m.name,
                    calories: m.calories,
                    protein: m.protein,
                    intake: m.intake,
                    type: m.type
                });
            }
        });
        return Array.from(map.values());
    }, [allMeals, meals]);

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

            {/* Unified Rows */}
            {itemsToRender.map((meal) => (
                <MealRow
                    key={meal.id}
                    meal={meal}
                    onUpdate={handleRowUpdate}
                    onDelete={onDelete}
                    isGhost={meal.isGhost}
                    recommendations={recommendations}
                    ref={el => rowRefs.current[meal.id] = el}
                />
            ))}
        </div>
    );
};

// Sub-component for single row
const MealRow = React.forwardRef(({ meal, onUpdate, onDelete, isGhost, recommendations }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const filteredSuggestions = useMemo(() => {
        if (!meal.name || !showSuggestions) return [];
        const lowerName = meal.name.toLowerCase();
        return recommendations
            .filter(r => {
                const rLower = r.name.toLowerCase();
                const isMatch = rLower.includes(lowerName);
                const isExact = rLower === lowerName;

                // If it's an exact match, only show it if it provides data the user hasn't typed yet
                // (e.g. they typed "쉐이크" but calories are empty, so we show the "쉐이크" recommendation with 115kcal)
                if (isExact) {
                    const hasNewData = (r.calories && !meal.calories) || (r.protein && !meal.protein);
                    return hasNewData;
                }

                return isMatch;
            })
            .slice(0, 5);
    }, [recommendations, meal.name, showSuggestions, meal.calories, meal.protein]);
    const getTypeLabel = (id) => MEAL_TYPES.find(t => t.id === id) || { label: id, color: '#888' };
    const typeObj = getTypeLabel(meal.type);

    const handleSelectSuggestion = (suggestion) => {
        onUpdate(meal.id, {
            name: suggestion.name,
            calories: suggestion.calories,
            protein: suggestion.protein,
            intake: suggestion.intake,
            type: suggestion.type
        });
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (filteredSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                const target = selectedIndex >= 0 ? filteredSuggestions[selectedIndex] : filteredSuggestions[0];
                if (target) {
                    e.preventDefault();
                    handleSelectSuggestion(target);
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    };

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
                opacity: 1, // Stable opacity to prevent repaint during IME
                position: 'relative'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '1rem', position: 'relative' }}>
                <div style={{ width: '1.2rem' }}></div>
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        name="meal-name"
                        value={meal.name}
                        placeholder="New"
                        onChange={e => {
                            onUpdate(meal.id, { name: e.target.value });
                            setShowSuggestions(true);
                            setSelectedIndex(-1);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={handleKeyDown}
                        style={{ border: 'none', padding: '0', width: '100%', outline: 'none', background: 'transparent' }}
                        autoComplete="off"
                    />

                    {/* Suggestions list */}
                    {showSuggestions && filteredSuggestions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: 'var(--bg-secondary, rgba(255, 255, 255, 0.9))',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            marginTop: '4px',
                            overflow: 'hidden'
                        }}>
                            {filteredSuggestions.map((suggestion, index) => (
                                <div
                                    key={suggestion.name}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    style={{
                                        padding: '0.6rem 1rem',
                                        cursor: 'pointer',
                                        backgroundColor: selectedIndex === index ? 'var(--bg-tertiary, #f0f0f0)' : 'transparent',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                        transition: 'background-color 0.2s ease'
                                    }}
                                >
                                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{suggestion.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px' }}>
                                        <span>🔥 {suggestion.calories}kcal</span>
                                        <span>💪 {suggestion.protein}g</span>
                                        <span style={{
                                            backgroundColor: getTypeLabel(suggestion.type).color,
                                            color: 'white',
                                            padding: '0 4px',
                                            borderRadius: '3px',
                                            fontSize: '0.7rem'
                                        }}>
                                            {getTypeLabel(suggestion.type).label}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
