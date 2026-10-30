import React, { useState, useRef, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Trash2, Plus, Sparkles, Loader2, AlertCircle, GripVertical } from 'lucide-react';
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
const GRID_TEMPLATE = 'minmax(150px, 2fr) 110px 95px 85px 80px 90px 105px 60px';

const InlineMealTable = ({ meals, allMeals = [], onUpdate, onDelete, onAdd }) => {
    // We manage the "next" item's ID in state so we can render it as a stable component
    // before and after it gets added to the list.
    const [nextId, setNextId] = useState(crypto.randomUUID());

    // Optimistic state to prevent UI jitter/disappearance during async DB updates.
    // Maps ID -> Full Meal Object
    const [overrides, setOverrides] = useState({});

    // 행 사이에 끼워 넣은 빈 행. ghost 행처럼 처음 입력할 때 DB에 추가된다.
    const [insertDraft, setInsertDraft] = useState(null);

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
                // 막 추가된 행의 override엔 timestamp가 없을 수 있어 DB 값 위에 덮는다
                result.push({ ...meal, ...overrides[meal.id] });
            } else {
                result.push(meal);
            }
        });
        // 끌어서 옮긴 행은 timestamp override만 먼저 바뀌므로 DB 반영 전에도 새 순서로 보이게 다시 정렬
        result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // 2. Add new meals from overrides (and the inserted draft row) that aren't in props.meals yet.
        // 중간에 삽입한 행은 timestamp 기준으로 제자리에, 나머지는 맨 뒤에 둔다.
        const pending = Object.values(overrides).filter(meal => !seenIds.has(meal.id));
        if (insertDraft && !seenIds.has(insertDraft.id)) pending.push(insertDraft);
        pending.forEach(meal => {
            const at = meal.timestamp == null ? -1 : result.findIndex(m => (m.timestamp ?? Infinity) > meal.timestamp);
            if (at === -1) result.push(meal);
            else result.splice(at, 0, meal);
            seenIds.add(meal.id);
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
    }, [meals, overrides, insertDraft, nextId]);

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
                        saved.type === unsaved.type &&
                        (unsaved.timestamp == null || saved.timestamp === unsaved.timestamp);

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

        if (item?.isDraft && !promotedIds.current.has(id)) {
            promoteDraft(item, updates);
            return;
        }

        // 1. Optimistic Update
        setOverrides(prev => {
            if (!item) return prev;
            return {
                ...prev,
                [id]: { ...(prev[id] ?? item), ...updates }
            };
        });

        // 2. Trigger DB Update
        onUpdate(id, updates);
    };

    // 삽입한 빈 행에 처음 입력하면 그때 DB에 추가 (timestamp는 삽입할 때 정한 값 유지)
    const promoteDraft = (draft, updates) => {
        const newMeal = { ...draft, ...updates };
        delete newMeal.isDraft;
        promotedIds.current.add(draft.id);
        setOverrides(prev => ({ ...prev, [newMeal.id]: newMeal }));
        setInsertDraft(null);
        onAdd(newMeal);
    };

    // 누른 행 바로 아래에 빈 행을 끼워 넣는다. 끼니 종류는 누른 행을 따르고,
    // timestamp를 위아래 행 사이 값으로 줘서 저장 후에도 그 자리에 정렬되게 한다.
    const handleInsertBelow = (meal) => {
        const rows = itemsToRender.filter(m => !m.isGhost && !m.isDraft);
        const next = rows[rows.findIndex(m => m.id === meal.id) + 1];
        const base = meal.timestamp ?? Date.now();
        const nextTs = next ? (next.timestamp ?? Date.now()) : Date.now() + 1;
        const id = crypto.randomUUID();
        // 모바일에서도 키보드가 바로 뜨도록 클릭 핸들러 안에서 동기로 그린 뒤 포커스
        flushSync(() => setInsertDraft({
            id,
            name: '',
            calories: '',
            protein: '',
            carbs: '',
            fat: '',
            intake: '',
            type: meal.type,
            timestamp: base < nextTs ? (base + nextTs) / 2 : base,
            isDraft: true
        }));
        rowRefs.current[id]?.querySelector('input[name="meal-name"]')?.focus();
    };

    const discardDraft = (id) => setInsertDraft(d => (d?.id === id ? null : d));

    // ---- 행 끌어서 순서 바꾸기 ----
    // 왼쪽 손잡이를 누른 채 위아래로 끌면 행이 따라오고 나머지 행이 비켜 준다.
    // 끄는 동안은 리렌더 없이 transform만 직접 바꾸고, 놓을 때 위아래 행 사이 timestamp로 저장한다.
    const tableRef = useRef(null);
    const dragRef = useRef(null);
    const [draggingId, setDraggingId] = useState(null);

    const handleDragStart = (e, id) => {
        if (e.button !== 0 || dragRef.current) return;
        e.preventDefault(); // 텍스트 선택·포커스 이동 막기
        // 끼워 넣다 만 빈 행이 있으면 치우고 시작 (행 위치 계산이 꼬이지 않게)
        if (insertDraft) flushSync(() => setInsertDraft(null));
        const rows = itemsToRender.filter(m => !m.isGhost && !m.isDraft);
        const els = rows.map(m => rowRefs.current[m.id]);
        const from = rows.findIndex(m => m.id === id);
        if (from === -1 || els.some(el => !el)) return;

        const tableTop = tableRef.current.getBoundingClientRect().top;
        const boxes = els.map(el => {
            const r = el.getBoundingClientRect();
            return { top: r.top - tableTop, height: r.height };
        });
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { rows, els, boxes, from, to: from, startY: e.clientY, tableTop };
        setDraggingId(id);

        els.forEach((el, i) => { el.style.transition = i === from ? 'none' : 'transform .15s ease'; });
        Object.assign(els[from].style, {
            zIndex: 5,
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        });
    };

    const handleDragMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        const self = d.boxes[d.from];
        const last = d.boxes[d.boxes.length - 1];
        // 끄는 중에 페이지가 스크롤돼도 맞도록 표 위치 변화를 더하고, 첫 행 위·마지막 행 아래로는 못 나가게 막는다
        const scrolled = d.tableTop - tableRef.current.getBoundingClientRect().top;
        const dy = Math.min(
            Math.max(e.clientY - d.startY + scrolled, d.boxes[0].top - self.top),
            last.top + last.height - self.top - self.height
        );
        const center = self.top + self.height / 2 + dy;
        const to = d.boxes.filter((b, i) => i !== d.from && b.top + b.height / 2 < center).length;
        d.to = to;
        d.els.forEach((el, i) => {
            let shift = 0;
            if (i === d.from) shift = dy;
            else if (d.from < to && i > d.from && i <= to) shift = -self.height;
            else if (to < d.from && i >= to && i < d.from) shift = self.height;
            el.style.transform = shift ? `translateY(${shift}px)` : '';
        });
    };

    const handleDragEnd = () => {
        const d = dragRef.current;
        if (!d) return;
        dragRef.current = null;

        if (d.to !== d.from) {
            const moved = d.rows[d.from];
            const order = d.rows.filter((_, i) => i !== d.from);
            const prevTs = d.to > 0 ? (order[d.to - 1].timestamp ?? 0) : null;
            const nextTs = d.to < order.length ? (order[d.to].timestamp ?? 0) : null;
            const ts = prevTs == null ? nextTs - 1000
                : nextTs == null ? Math.max(prevTs + 1, Date.now())
                : (prevTs + nextTs) / 2;
            // 새 순서를 DOM에 먼저 반영한 뒤 transform을 지워야 놓는 순간 원래 자리로 튀지 않는다
            flushSync(() => {
                if ((prevTs == null || ts > prevTs) && (nextTs == null || ts < nextTs)) {
                    handleRowUpdate(moved.id, { timestamp: ts });
                    // 다른 기기도 이 날 순서를 그대로 따르도록 나머지 행도 지금 timestamp로 다시 저장(동기화 대상)
                    order.forEach(m => handleRowUpdate(m.id, { timestamp: m.timestamp }));
                } else {
                    // 위아래 timestamp가 같아서 사이 값이 없으면 그날 행 순서를 처음부터 다시 매긴다
                    order.splice(d.to, 0, moved);
                    const base = Math.min(...order.map(m => m.timestamp ?? 0));
                    order.forEach((m, i) => {
                        if (m.timestamp !== base + i * 1000) handleRowUpdate(m.id, { timestamp: base + i * 1000 });
                    });
                }
                setDraggingId(null);
            });
        } else {
            setDraggingId(null);
        }

        d.els.forEach(el => {
            Object.assign(el.style, { transform: '', transition: '', zIndex: '', background: '', borderRadius: '', boxShadow: '' });
        });
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

    // 방향키 ↑/↓ 로 같은 열의 위/아래 행으로 이동 (엑셀처럼).
    // 이름 칸 추천 목록이 열려 있으면 MealRow 쪽에서 먼저 처리(preventDefault)하므로 건드리지 않는다.
    const handleGridKeyDown = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        if (e.isDefaultPrevented() || e.nativeEvent.isComposing || e.keyCode === 229) return;
        const col = e.target.dataset?.col;
        if (!col) return;
        e.preventDefault(); // 숫자 칸에서 값이 ±1 되는 기본 동작 막기
        const row = e.target.closest('[data-meal-row]');
        const sibling = e.key === 'ArrowDown' ? row?.nextElementSibling : row?.previousElementSibling;
        const target = sibling?.matches('[data-meal-row]') ? sibling.querySelector(`[data-col="${col}"]`) : null;
        if (!target) return;
        target.focus();
        // 바로 덮어쓸 수 있게 기존 값 전체 선택 (select 박스는 해당 없음)
        if (typeof target.select === 'function') target.select();
    };

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
                .row-actions{display:flex;gap:4px;opacity:0;visibility:hidden;transition:opacity .15s ease,visibility .15s;}
                .meal-row:hover .row-actions,.meal-row:focus-within .row-actions{opacity:1;visibility:visible;}
                .row-action-btn{
                    display:flex;align-items:center;justify-content:center;
                    width:24px;height:24px;border-radius:6px;
                    border:1px solid var(--border-color);color:var(--text-tertiary);
                    transition:all .15s ease;
                }
                .row-action-btn.add:hover{color:#27AE60;border-color:rgba(39,174,96,0.5);background:rgba(39,174,96,0.12);}
                .row-action-btn.delete:hover{color:#EB5757;border-color:rgba(235,87,87,0.5);background:rgba(235,87,87,0.12);}
                .drag-handle{
                    display:flex;align-items:center;justify-content:center;
                    width:1.2rem;height:24px;flex-shrink:0;border-radius:4px;
                    color:var(--text-tertiary);cursor:grab;touch-action:none;
                    opacity:0;visibility:hidden;transition:opacity .15s ease,visibility .15s;
                }
                .meal-row:hover .drag-handle,.meal-row:focus-within .drag-handle,.meal-row.dragging .drag-handle{opacity:1;visibility:visible;}
                .drag-handle:hover{color:var(--text-primary);background:rgba(255,255,255,0.06);}
                .meal-row.dragging .drag-handle{cursor:grabbing;color:var(--text-primary);}
                /* 터치 기기는 hover가 없으니 손잡이를 항상 흐리게 보여준다 */
                @media (hover: none){.drag-handle{opacity:.45;visibility:visible;}}
            `}</style>
            <div ref={tableRef} style={{ minWidth: '804px', fontSize: '0.95rem' }} onKeyDown={handleGridKeyDown}>
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
                        onInsertBelow={handleInsertBelow}
                        onDiscardDraft={discardDraft}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingId === meal.id}
                        isGhost={meal.isGhost}
                        isDraft={meal.isDraft}
                        recommendations={recommendations}
                        ref={el => rowRefs.current[meal.id] = el}
                    />
                ))}
            </div>
        </div>
    );
};

// Sub-component for single row
const MealRow = React.forwardRef(({ meal, onUpdate, onDelete, onInsertBelow, onDiscardDraft, onDragStart, onDragMove, onDragEnd, isDragging, isGhost, isDraft, recommendations }, ref) => {
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
            data-meal-row
            className={`meal-row${isDragging ? ' dragging' : ''}`}
            // 삽입만 하고 아무것도 적지 않은 채 행을 벗어나면 빈 행은 치운다 (조합 중인 글자가 있으면 유지)
            onBlur={isDraft ? (e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return;
                if (e.currentTarget.querySelector('input[name="meal-name"]')?.value) return;
                onDiscardDraft(meal.id);
            } : undefined}
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
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '1rem', position: 'relative' }}>
                {/* 순서 바꾸기 손잡이: 누른 채 위아래로 끌기. 새 행·끼워 넣은 빈 행엔 없음 */}
                {!isGhost && !isDraft ? (
                    <div
                        className="drag-handle"
                        onPointerDown={e => onDragStart(e, meal.id)}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragEnd}
                        onPointerCancel={onDragEnd}
                        title="끌어서 순서 바꾸기"
                    >
                        <GripVertical size={14} />
                    </div>
                ) : (
                    <div style={{ width: '1.2rem' }}></div>
                )}
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        name="meal-name"
                        data-col="name"
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
                                setShowSuggestions(true);
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
                        // 추천 목록은 포커스만으로는 열지 않고 입력을 시작해야 연다 (방향키 ↑/↓가 행 이동에 쓰이도록)
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
                    data-col="calories"
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
                    data-col="protein"
                    value={meal.protein}
                    onChange={e => onUpdate(meal.id, { protein: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    data-col="carbs"
                    value={meal.carbs ?? ''}
                    onChange={e => onUpdate(meal.id, { carbs: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    data-col="fat"
                    value={meal.fat ?? ''}
                    onChange={e => onUpdate(meal.id, { fat: e.target.value })}
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '1rem' }}>
                <input
                    type="number"
                    inputMode="decimal"
                    data-col="intake"
                    value={meal.intake || ''}
                    onChange={e => onUpdate(meal.id, { intake: e.target.value })}
                    placeholder=""
                    style={{ border: 'none', padding: '0', width: '100%', textAlign: 'right', outline: 'none' }}
                />
            </div>

            <div style={{ paddingRight: '0.5rem' }}>
                <select
                    data-col="type"
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
                {/* 마우스를 올리거나 행 안에 포커스가 있을 때만 표시. Tab 순서에는 넣지 않는다 */}
                {!isGhost && !isDraft && (
                    <div className="row-actions">
                        <button
                            className="row-action-btn add"
                            onClick={() => onInsertBelow(meal)}
                            tabIndex={-1}
                            title="아래에 행 추가"
                            aria-label="아래에 행 추가"
                        >
                            <Plus size={14} />
                        </button>
                        <button
                            className="row-action-btn delete"
                            onClick={() => onDelete(meal.id)}
                            tabIndex={-1}
                            title="삭제"
                            aria-label="삭제"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default InlineMealTable;
