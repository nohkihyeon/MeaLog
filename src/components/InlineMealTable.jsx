import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { calcMacroKcal, round1 } from '../utils/nutrition';
import { analyzeFoodName, hasGeminiKey } from '../utils/gemini';
import AiFoodModal from './AiFoodModal';

const MEAL_TYPES = [
    { id: 'breakfast', label: '아침', color: '#2F80ED' },
    { id: 'lunch', label: '점심', color: '#F2C94C' },
    { id: 'dinner', label: '저녁', color: '#27AE60' },
    { id: 'snack', label: '간식', color: '#EB5757' },
    { id: 'healthy', label: '건강식', color: '#56CCF2' },
    { id: 'cheat', label: '치팅데이', color: '#BB6BD9' },
];

// Header and rows are separate grid containers, so they must share one template
const GRID_TEMPLATE = 'minmax(150px, 2fr) 110px 95px 85px 80px 90px 105px 36px';

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
            carbs: '',
            fat: '',
            intake: '',
            type: defaultType,
            isGhost: true
        });

        return result;
    }, [meals, overrides, nextId]);

    // Cleanup overrides when DB catches up
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- IME 조합 중 리포커스를 피하려고 의도적으로 effect에서 정리한다
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
                        String(saved.carbs ?? '') === String(unsaved.carbs ?? '') &&
                        String(saved.fat ?? '') === String(unsaved.fat ?? '') &&
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
            carbs: '',
            fat: '',
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
            const hasData = m.calories || m.protein || m.carbs || m.fat || m.intake;
            if (m.name && hasData && !map.has(m.name)) {
                map.set(m.name, {
                    name: m.name,
                    calories: m.calories,
                    protein: m.protein,
                    carbs: m.carbs ?? '',
                    fat: m.fat ?? '',
                    intake: m.intake,
                    type: m.type
                });
            }
        });
        return Array.from(map.values());
    }, [allMeals, meals]);

    return (
        <div className="meal-table-scroll">
            <style>{`
                .ai-fill-btn{
                    display:flex;align-items:center;justify-content:center;
                    width:22px;height:22px;flex-shrink:0;border-radius:999px;
                    border:1px solid rgba(187,107,217,0.45);
                    background:rgba(187,107,217,0.12);color:#BB6BD9;cursor:pointer;
                    transition:all .15s ease;
                }
                .ai-fill-btn:hover{background:rgba(187,107,217,0.28);box-shadow:0 0 8px rgba(187,107,217,0.35);}
                .ai-spin{animation:ai-spin 1s linear infinite;}
                @keyframes ai-spin{to{transform:rotate(360deg)}}
            `}</style>
            <div style={{ minWidth: '780px', fontSize: '0.95rem' }}>
                {/* Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: GRID_TEMPLATE,
                    gap: '0',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🍲 음식</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚖️ 칼로리(Kcal)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🔥 단백질(g)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🍚 탄수(g)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🥑 지방(g)</div>
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
        </div>
    );
};

// Sub-component for single row
const MealRow = React.forwardRef(({ meal, onUpdate, onDelete, isGhost, recommendations }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    // --- AI 이름 검색(탄단지·칼로리 자동 채움) ---
    const [aiStatus, setAiStatus] = useState('idle'); // idle | loading | error
    const [aiInfo, setAiInfo] = useState(null); // 애매할 때 팝업에 넘길 결과
    const aiErrorTimer = useRef(null);
    useEffect(() => () => clearTimeout(aiErrorTimer.current), []);

    // per_100g 값을 grams 에 비례시켜 행에 채워 넣는다 (섭취량도 함께 기록)
    const applyAiValues = (info, grams) => {
        const s = grams / 100;
        onUpdate(meal.id, {
            calories: String(Math.round((info.per100.calories_kcal || 0) * s)),
            carbs: String(round1((info.per100.carbs_g || 0) * s)),
            protein: String(round1((info.per100.protein_g || 0) * s)),
            fat: String(round1((info.per100.fat_g || 0) * s)),
            intake: String(grams),
        });
    };

    const handleAiLookup = async () => {
        if (aiStatus === 'loading') return;
        setAiStatus('loading');
        try {
            const info = await analyzeFoodName(meal.name.trim());
            if (info.confidence === 'high') {
                // 명확한 단품: 되묻지 않고 1회 제공량 기준으로 바로 채움
                applyAiValues(info, info.servingG);
            } else {
                // 애매: 팝업으로 양을 되물어본다
                setAiInfo(info);
            }
            setAiStatus('idle');
        } catch (err) {
            console.error('AI 이름 검색 실패', err);
            setAiStatus('error');
            aiErrorTimer.current = setTimeout(() => setAiStatus('idle'), 4000);
        }
    };

    // --- IME composition handling (Safari fix) ---
    // While a Hangul/IME composition is in progress, every intermediate keystroke still
    // fires onChange. Previously each of those events was committed straight to parent
    // state, which (for the "New" ghost row) promotes it into a real row and inserts a
    // fresh ghost row below it — a DOM/list structure change happening WHILE Safari is
    // mid-composition. Safari (unlike Chrome) tends to kill/garble the composition when
    // the surrounding DOM is mutated like that, which shows up as dropped characters.
    // Fix: buffer the value locally during composition and only commit to parent state
    // once the composition session actually finishes.
    const isComposingRef = useRef(false);
    const [draftName, setDraftName] = useState(null);

    // What the user is actually seeing in the input right now — the in-progress composition
    // draft if there is one, otherwise the committed value from parent state. Suggestion
    // matching should always run off this, NOT off meal.name, so the dropdown still updates
    // instantly on every keystroke (e.g. after just "쉐") even though committing the value to
    // parent state (row promotion / DB write) is deferred until the composition finishes.
    const displayName = draftName !== null ? draftName : meal.name;

    const filteredSuggestions = useMemo(() => {
        if (!displayName || !showSuggestions) return [];
        const lowerName = displayName.toLowerCase();
        return recommendations
            .filter(r => {
                const rLower = r.name.toLowerCase();
                const isMatch = rLower.includes(lowerName);
                const isExact = rLower === lowerName;

                // If it's an exact match, only show it if it provides data the user hasn't typed yet
                // (e.g. they typed "쉐이크" but calories are empty, so we show the "쉐이크" recommendation with 115kcal)
                if (isExact) {
                    const hasNewData = (r.calories && !meal.calories) || (r.protein && !meal.protein) ||
                        (r.carbs && !meal.carbs) || (r.fat && !meal.fat);
                    return hasNewData;
                }

                return isMatch;
            })
            .slice(0, 5);
    }, [recommendations, displayName, showSuggestions, meal.calories, meal.protein, meal.carbs, meal.fat]);

    // 탄단지가 입력돼 있고 칼로리가 비어 있으면 4/4/9 환산값을 자동으로 보여준다
    const macroKcal = calcMacroKcal(meal);
    const caloriesEmpty = meal.calories === '' || meal.calories === null || meal.calories === undefined;
    const showAutoCalories = caloriesEmpty && macroKcal > 0;
    const getTypeLabel = (id) => MEAL_TYPES.find(t => t.id === id) || { label: id, color: '#888' };
    const typeObj = getTypeLabel(meal.type);

    // 이름만 단독으로 입력돼 있고(탄단지·칼로리 전부 비어 있음) 키가 있으면 AI 버튼 노출
    const macrosEmpty = !meal.calories && !meal.protein && !meal.carbs && !meal.fat;
    const showAiButton = Boolean(meal.name && meal.name.trim()) && macrosEmpty && hasGeminiKey();

    const handleSelectSuggestion = (suggestion) => {
        onUpdate(meal.id, {
            name: suggestion.name,
            calories: suggestion.calories,
            protein: suggestion.protein,
            carbs: suggestion.carbs ?? '',
            fat: suggestion.fat ?? '',
            intake: suggestion.intake,
            // Keep the meal type already set on this row (defaults to the current date's
            // next expected meal type) instead of overwriting it with the suggestion's
            // historical type.
        });
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const commitName = (val) => {
        onUpdate(meal.id, { name: val });
        setShowSuggestions(true);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e) => {
        // Don't hijack Enter/Tab/Arrow keys while an IME composition is still active —
        // those keys are often used to confirm/navigate the composition itself, not to
        // pick a suggestion. (e.keyCode === 229 is the legacy signal older Safari/WebKit
        // builds use instead of nativeEvent.isComposing.)
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;

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
                gridTemplateColumns: GRID_TEMPLATE,
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
                        value={displayName}
                        placeholder="New"
                        onChange={e => {
                            const val = e.target.value;
                            if (isComposingRef.current) {
                                // Mid-composition: update the local draft (this alone drives
                                // filteredSuggestions above, so the dropdown still reacts on
                                // every keystroke) without touching parent state / triggering
                                // row promotion until the composition session finishes.
                                setDraftName(val);
                                setSelectedIndex(-1);
                                return;
                            }
                            commitName(val);
                        }}
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={e => {
                            isComposingRef.current = false;
                            setDraftName(null);
                            commitName(e.target.value);
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
                                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                                        {suggestion.name}
                                        {suggestion.intake && (
                                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>
                                                ({suggestion.intake}g)
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', gap: '8px' }}>
                                        <span>🔥 {suggestion.calories}kcal</span>
                                        <span>💪 {suggestion.protein}g</span>
                                        {suggestion.carbs !== '' && <span>🍚 {suggestion.carbs}g</span>}
                                        {suggestion.fat !== '' && <span>🥑 {suggestion.fat}g</span>}
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

                {/* AI 자동 채움: 이름만 있을 때 작게 표시 → 클릭 시 같은 자리에서 로딩 */}
                {showAiButton && (
                    aiStatus === 'loading' ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', flexShrink: 0 }}>
                            <Loader2 size={14} color="#BB6BD9" className="ai-spin" />
                        </span>
                    ) : aiStatus === 'error' ? (
                        <button
                            onClick={handleAiLookup}
                            className="ai-fill-btn"
                            style={{ borderColor: 'rgba(235,87,87,0.5)', background: 'rgba(235,87,87,0.12)', color: '#EB5757' }}
                            title="AI 조회에 실패했어요. 다시 시도하려면 클릭"
                            aria-label="AI 조회 재시도"
                        >
                            <AlertCircle size={13} />
                        </button>
                    ) : (
                        <button
                            onClick={handleAiLookup}
                            className="ai-fill-btn"
                            title={`"${meal.name}" 탄단지·칼로리 AI로 채우기`}
                            aria-label="AI로 영양정보 채우기"
                        >
                            <Sparkles size={13} />
                        </button>
                    )
                )}
            </div>

            {/* 애매한 음식: 양(g) 확인 팝업 */}
            {aiInfo && (
                <AiFoodModal
                    name={meal.name}
                    question={aiInfo.question}
                    servingG={aiInfo.servingG}
                    per100={aiInfo.per100}
                    onConfirm={(grams) => {
                        applyAiValues(aiInfo, grams);
                        setAiInfo(null);
                    }}
                    onClose={() => setAiInfo(null)}
                />
            )}

            <div style={{ paddingRight: '1rem', position: 'relative' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    value={meal.calories}
                    onChange={e => onUpdate(meal.id, { calories: e.target.value })}
                    title={macroKcal > 0 ? `탄단지 환산 약 ${macroKcal}kcal (직접 입력하면 그 값이 우선)` : undefined}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
                {/* 칼로리를 직접 입력하지 않았을 때, 탄단지 환산값을 흰색·흐릿하게 표시. 합계에는 자동 반영됨 */}
                {showAutoCalories && (
                    <span
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            color: '#FFFFFF',
                            opacity: 0.45,
                            filter: 'blur(0.4px)',
                            pointerEvents: 'none'
                        }}
                    >
                        {macroKcal}
                    </span>
                )}
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    value={meal.protein}
                    onChange={e => onUpdate(meal.id, { protein: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    value={meal.carbs ?? ''}
                    onChange={e => onUpdate(meal.id, { carbs: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    value={meal.fat ?? ''}
                    onChange={e => onUpdate(meal.id, { fat: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
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
