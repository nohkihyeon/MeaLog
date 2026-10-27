import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Minus, Plus, Trash2, Check, RefreshCw, Loader2, Sparkles, SkipForward, AlertCircle, PenLine } from 'lucide-react';
import { analyzeFoodImage, hasGeminiKey } from '../utils/gemini';
import { readPhotoTakenAt } from '../utils/exif';

const MEAL_TYPES = [
    { id: 'breakfast', label: '아침', color: '#2F80ED' },
    { id: 'lunch', label: '점심', color: '#F2C94C' },
    { id: 'dinner', label: '저녁', color: '#27AE60' },
    { id: 'snack', label: '간식', color: '#EB5757' },
    { id: 'healthy', label: '건강식', color: '#56CCF2' },
    { id: 'cheat', label: '치팅데이', color: '#BB6BD9' },
];

const PORTION_PRESETS = [
    { label: '전부', value: 100 },
    { label: '¾', value: 75 },
    { label: '½', value: 50 },
    { label: '¼', value: 25 },
];

// 앨범에서 한 번에 고를 수 있는 최대 장수 (무료 티어 일일 요청 한도 고려)
const MAX_PHOTOS = 10;

// 인식이 틀렸을 때 탭 한 번으로 붙이는 메모
const HINT_CHIPS = ['곱빼기', '밥 반 공기', '소스·드레싱 없이', '편의점 제품', '배달 음식'];

// 캔버스로 긴 변 maxSize 이하로 축소 후 JPEG dataURL 반환 (요청 용량/속도 절감)
function resizeImage(file, maxSize = 1024) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 촬영 시각으로 끼니를 추정. 없으면 현재 시각.
const defaultMealType = (time = Date.now()) => {
    const h = new Date(time).getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
};

const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shortDate = (s) => {
    const [, m, d] = s.split('-');
    return `${Number(m)}/${Number(d)}`;
};
const formatTakenAt = (d) => d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

let entrySeq = 0;
// 사진 1장 = 분석 결과 + 날짜/인원/먹은양/끼니 설정을 각각 따로 가진다
// 촬영 시각(EXIF)이 있으면 그 날짜·끼니가 기본값, 없으면 지금 보고 있는 날짜 + 현재 시각 기준
const makeEntry = (file, takenAt, viewDate) => ({
    id: ++entrySeq,
    file,
    takenAt,
    photoDate: takenAt ? toDateStr(takenAt) : null,
    date: takenAt ? toDateStr(takenAt) : viewDate,
    imageUrl: null,
    status: 'pending', // pending | analyzing | done | error
    items: [],
    note: '',
    source: 'photo', // photo | label(영양성분표)
    hint: '',
    hintOpen: false,
    error: '',
    people: 1,
    portionPct: 100,
    mealType: defaultMealType(takenAt ?? undefined),
});

// 인원수로 나누고 먹은 양을 반영한 1인분 환산 비율
const factorOf = (entry) => (entry.portionPct / 100) / Math.max(1, entry.people);

const toMeals = (entry) => {
    const factor = factorOf(entry);
    const adj = (v) => Math.round((Number(v) || 0) * factor);
    return entry.items.map((it) => {
        const w = adj(it.weight_g);
        const baseName = it.name || '음식';
        return {
            name: w > 0 ? `${baseName} (${w}g)` : baseName,
            date: entry.date,
            type: entry.mealType,
            calories: adj(it.calories_kcal),
            protein: adj(it.protein_g),
            carbs: adj(it.carbs_g),
            fat: adj(it.fat_g),
        };
    });
};

const numStyle = {
    width: '100%',
    padding: '0.4rem 0.5rem',
    fontSize: '0.9rem',
    textAlign: 'right',
    background: '#161616',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
};

const PhotoMealModal = ({ isOpen, onClose, onConfirm, date }) => {
    const [entries, setEntries] = useState([]);
    const [current, setCurrent] = useState(0);
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    // 새로 선택하거나 닫으면 증가 → 진행 중이던 분석 결과는 버린다
    const runIdRef = useRef(0);

    if (!isOpen) return null;

    const entry = entries[current];
    const isMulti = entries.length > 1;
    const hasNext = current + 1 < entries.length;
    const rest = entries.slice(current);
    const restAnalyzing = rest.some((e) => e.status === 'pending' || e.status === 'analyzing');
    const restDoneCount = rest.filter((e) => e.status === 'done').length;

    const factor = entry ? factorOf(entry) : 1;
    const adj = (v) => Math.round((Number(v) || 0) * factor);

    const totals = (entry?.items ?? []).reduce(
        (a, it) => ({
            calories: a.calories + adj(it.calories_kcal),
            carbs: a.carbs + adj(it.carbs_g),
            protein: a.protein + adj(it.protein_g),
            fat: a.fat + adj(it.fat_g),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );

    const reset = () => {
        runIdRef.current += 1;
        setEntries([]);
        setCurrent(0);
    };

    const close = () => {
        reset();
        onClose();
    };

    const patchEntry = (id, patch) =>
        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

    const analyzeEntry = async (target, runId) => {
        patchEntry(target.id, { status: 'analyzing', error: '' });
        try {
            const dataUrl = target.imageUrl || (await resizeImage(target.file));
            if (runId !== runIdRef.current) return;
            patchEntry(target.id, { imageUrl: dataUrl });
            const result = await analyzeFoodImage(dataUrl, target.hint);
            if (runId !== runIdRef.current) return;
            if (!result.items.length) {
                patchEntry(target.id, { status: 'error', error: '사진에서 음식을 찾지 못했어요. 다른 사진으로 시도해보세요.' });
                return;
            }
            patchEntry(target.id, { status: 'done', items: result.items, note: result.note || '', source: result.source });
        } catch (err) {
            if (runId !== runIdRef.current) return;
            console.error('분석 실패', err);
            patchEntry(target.id, { status: 'error', error: err.message || '분석 중 오류가 발생했습니다.' });
        }
    };

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS);
        e.target.value = '';
        if (!files.length) return;
        const runId = ++runIdRef.current;
        const takenAts = await Promise.all(files.map(readPhotoTakenAt));
        if (runId !== runIdRef.current) return;
        const newEntries = files.map((file, i) => makeEntry(file, takenAts[i], date));
        setEntries(newEntries);
        setCurrent(0);
        // 분당 요청 한도를 넘지 않도록 한 장씩 순차 분석 (첫 장 확인하는 동안 나머지는 뒤에서 진행)
        for (const target of newEntries) {
            if (runId !== runIdRef.current) return;
            await analyzeEntry(target, runId);
        }
    };

    const retry = () => analyzeEntry(entry, runIdRef.current);

    const goNext = () => {
        if (hasNext) setCurrent(current + 1);
        else close();
    };

    const updateCurrent = (patch) => patchEntry(entry.id, patch);

    const updateItem = (idx, key, value) =>
        updateCurrent({ items: entry.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) });

    const removeItem = (idx) => updateCurrent({ items: entry.items.filter((_, i) => i !== idx) });

    const handleConfirm = () => {
        onConfirm(toMeals(entry));
        goNext();
    };

    // 현재 사진 + 아직 확인 안 한 나머지 사진을 AI 추정값 그대로 한 번에 저장
    const handleSaveAll = () => {
        onConfirm(rest.filter((e) => e.status === 'done').flatMap(toMeals));
        close();
    };

    const noKey = !hasGeminiKey();

    return (
        <div
            onClick={close}
            style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 1000, padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="card"
                style={{
                    width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto',
                    padding: '1.5rem', border: '1px solid var(--border-color)',
                    backgroundColor: '#1E1E1E', borderRadius: '14px',
                }}
            >
                <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={18} color="#EB5757" /> 사진으로 식단 추가
                    </h2>
                    <button onClick={close} aria-label="닫기"><X size={22} color="var(--text-secondary)" /></button>
                </div>

                {/* 여러 장 선택 시 진행 상황 */}
                {isMulti && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.15rem' }}>
                            {entries.map((en, i) => (
                                <div
                                    key={en.id}
                                    style={{
                                        position: 'relative', flexShrink: 0, width: '40px', height: '40px',
                                        borderRadius: '8px', overflow: 'hidden', background: '#161616',
                                        border: `2px solid ${i === current ? '#EB5757' : 'var(--border-color)'}`,
                                        opacity: i < current ? 0.45 : 1,
                                    }}
                                >
                                    {en.imageUrl && <img src={en.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                    {(i < current || en.status === 'analyzing' || en.status === 'error') && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
                                            {i < current ? <Check size={16} color="#fff" />
                                                : en.status === 'analyzing' ? <Loader2 size={16} color="#fff" className="spin" />
                                                    : <AlertCircle size={16} color="#EB5757" />}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {current + 1} / {entries.length}
                        </span>
                    </div>
                )}

                {/* STEP: SELECT */}
                {!entry && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            음식 사진을 올리면 AI가 음식·무게·탄단지·칼로리를 추정해요.
                            영양성분표 사진은 표의 숫자를 그대로 읽어요.
                            결과는 저장 전에 직접 확인하고 수정할 수 있어요.
                            앨범에서는 최대 {MAX_PHOTOS}장까지 한 번에 고를 수 있어요.
                        </p>
                        {noKey && (
                            <div style={{ background: '#3a2a12', border: '1px solid #6b4a1a', color: '#f1c27d', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                ⚠️ AI 분석을 쓸 수 없어요. <code>.env</code>에 Supabase 설정(또는 로컬 개발용 <code>VITE_GEMINI_API_KEY</code>)을 넣고 앱을 다시 시작하세요.
                            </div>
                        )}
                        {/* 촬영: capture로 카메라 직행 / 앨범·파일: capture 없이 네이티브 선택기(여러 장 선택 가능) */}
                        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFiles} />
                        <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => cameraRef.current?.click()}
                                disabled={noKey}
                                style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                                    padding: '1.6rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px',
                                    background: '#161616', color: 'var(--text-secondary)', cursor: noKey ? 'not-allowed' : 'pointer',
                                    opacity: noKey ? 0.5 : 1,
                                }}
                            >
                                <Camera size={28} color="#EB5757" />
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>촬영하기</span>
                                <span style={{ fontSize: '0.75rem' }}>카메라로 바로 찍기</span>
                            </button>
                            <button
                                onClick={() => galleryRef.current?.click()}
                                disabled={noKey}
                                style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                                    padding: '1.6rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px',
                                    background: '#161616', color: 'var(--text-secondary)', cursor: noKey ? 'not-allowed' : 'pointer',
                                    opacity: noKey ? 0.5 : 1,
                                }}
                            >
                                <ImageIcon size={28} color="#56CCF2" />
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>앨범·파일</span>
                                <span style={{ fontSize: '0.75rem' }}>여러 장 선택 가능</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: ANALYZING */}
                {entry && (entry.status === 'pending' || entry.status === 'analyzing') && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1.5rem 0' }}>
                        {entry.imageUrl && <img src={entry.imageUrl} alt="음식" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '10px' }} />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
                            <Loader2 size={20} className="spin" />
                            <span>AI가 음식을 분석하는 중…</span>
                        </div>
                    </div>
                )}

                {/* STEP: ERROR */}
                {entry?.status === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem 0' }}>
                        {entry.imageUrl && <img src={entry.imageUrl} alt="음식" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '10px' }} />}
                        <p style={{ color: '#EB5757', textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.5 }}>{entry.error}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            {isMulti ? (
                                <button onClick={goNext} style={{ ...secondaryBtn, flex: 1 }}>
                                    <SkipForward size={15} /> 건너뛰기
                                </button>
                            ) : (
                                <button onClick={reset} style={{ ...secondaryBtn, flex: 1 }}>
                                    <ImageIcon size={15} /> 다른 사진
                                </button>
                            )}
                            <button onClick={retry} style={{ ...primaryBtn, flex: 1 }}>
                                <RefreshCw size={16} /> 다시 분석
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: REVIEW (HIL) */}
                {entry?.status === 'done' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        <div style={{ background: '#161616', borderRadius: '10px', padding: '0.75rem 0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {entry.imageUrl && <img src={entry.imageUrl} alt="음식" style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px' }} />}
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                <strong>{entry.source === 'label' ? '성분표를 읽었어요. 맞나요?' : '이거 드신 거 맞나요?'}</strong>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    {entry.takenAt && <>{formatTakenAt(entry.takenAt)} 촬영 · </>}아래 값을 확인하고 필요하면 수정하세요.
                                </div>
                            </div>
                        </div>

                        {/* 인식이 틀렸을 때만 펼치는 메모 → 다시 분석 (기본 흐름엔 단계 추가 없음) */}
                        {entry.hintOpen ? (
                            <div style={{ background: '#161616', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input
                                        autoFocus
                                        value={entry.hint}
                                        onChange={(e) => updateCurrent({ hint: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.nativeEvent.isComposing && entry.hint.trim()) retry();
                                        }}
                                        placeholder="예: 밥 반 공기, 곱빼기, 편의점 도시락"
                                        style={{ ...numStyle, textAlign: 'left' }}
                                    />
                                    <button
                                        onClick={retry}
                                        disabled={!entry.hint.trim()}
                                        style={{ ...primaryBtn, flexShrink: 0, padding: '0.4rem 0.75rem', fontSize: '0.82rem', opacity: entry.hint.trim() ? 1 : 0.5 }}
                                    >
                                        <RefreshCw size={14} /> 다시 분석
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {HINT_CHIPS.map((chip) => (
                                        <button
                                            key={chip}
                                            onClick={() => updateCurrent({ hint: entry.hint.trim() ? `${entry.hint.trim()}, ${chip}` : chip })}
                                            style={{
                                                padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', cursor: 'pointer',
                                                border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)',
                                            }}
                                        >
                                            + {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => updateCurrent({ hintOpen: true })}
                                style={{
                                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'transparent',
                                    border: 'none', cursor: 'pointer', padding: 0,
                                }}
                            >
                                <PenLine size={14} /> 다르게 인식됐나요? 메모 남기고 다시 분석
                            </button>
                        )}

                        {/* 촬영일이 지금 보는 날짜와 다를 때만 어느 날로 기록할지 선택 */}
                        {entry.photoDate && entry.photoDate !== date && (
                            <div>
                                <div style={labelStyle}>어느 날로 기록할까요?</div>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    {[[entry.photoDate, '찍은 날'], [date, '지금 보는 날']].map(([d, lbl]) => (
                                        <button
                                            key={d}
                                            onClick={() => updateCurrent({ date: d })}
                                            style={{
                                                flex: 1, padding: '0.45rem 0', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
                                                border: `1px solid ${entry.date === d ? '#EB5757' : 'var(--border-color)'}`,
                                                background: entry.date === d ? 'rgba(235,87,87,0.15)' : 'transparent',
                                                color: entry.date === d ? '#EB5757' : 'var(--text-secondary)', fontWeight: 600,
                                            }}
                                        >
                                            {shortDate(d)} ({lbl})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 끼니 종류 */}
                        <div>
                            <div style={labelStyle}>끼니</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {MEAL_TYPES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => updateCurrent({ mealType: t.id })}
                                        style={{
                                            padding: '0.35rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer',
                                            border: `1px solid ${entry.mealType === t.id ? t.color : 'var(--border-color)'}`,
                                            background: entry.mealType === t.id ? t.color : 'transparent',
                                            color: entry.mealType === t.id ? '#111' : 'var(--text-secondary)', fontWeight: 600,
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 인원수 나누기 */}
                        <div>
                            <div style={labelStyle}>몇 명이서 드셨나요? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(나눠서 1인분 계산)</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button onClick={() => updateCurrent({ people: Math.max(1, entry.people - 1) })} style={stepBtn} aria-label="인원 감소"><Minus size={16} /></button>
                                <input
                                    type="number" inputMode="numeric" min="1" value={entry.people}
                                    onChange={(e) => updateCurrent({ people: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                                    style={{ ...numStyle, width: '60px', textAlign: 'center' }}
                                />
                                <button onClick={() => updateCurrent({ people: entry.people + 1 })} style={stepBtn} aria-label="인원 증가"><Plus size={16} /></button>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>명</span>
                            </div>
                        </div>

                        {/* 먹은 양 */}
                        <div>
                            <div style={labelStyle}>이 중에서 얼마나 드셨나요?</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {PORTION_PRESETS.map((p) => (
                                    <button
                                        key={p.value}
                                        onClick={() => updateCurrent({ portionPct: p.value })}
                                        style={{
                                            flex: 1, padding: '0.45rem 0', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
                                            border: `1px solid ${entry.portionPct === p.value ? '#EB5757' : 'var(--border-color)'}`,
                                            background: entry.portionPct === p.value ? 'rgba(235,87,87,0.15)' : 'transparent',
                                            color: entry.portionPct === p.value ? '#EB5757' : 'var(--text-secondary)', fontWeight: 600,
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 항목별 영양 정보 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {entry.items.map((it, idx) => (
                                <div key={idx} style={{ background: '#161616', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                                        <input
                                            value={it.name}
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                            style={{ ...numStyle, textAlign: 'left', fontWeight: 600, fontSize: '0.95rem' }}
                                        />
                                        <button onClick={() => removeItem(idx)} aria-label="항목 삭제" style={{ flexShrink: 0, padding: '0.3rem' }}>
                                            <Trash2 size={16} color="var(--text-secondary)" />
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                                        {[
                                            ['weight_g', '중량 g'],
                                            ['carbs_g', '탄수 g'],
                                            ['protein_g', '단백 g'],
                                            ['fat_g', '지방 g'],
                                            ['calories_kcal', 'kcal'],
                                        ].map(([key, lbl]) => (
                                            <div key={key}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', textAlign: 'center' }}>{lbl}</div>
                                                <input
                                                    type="number" inputMode="decimal" min="0" value={it[key]}
                                                    onChange={(e) => updateItem(idx, key, e.target.value)}
                                                    onBlur={(e) => updateItem(idx, key, Math.max(0, Number(e.target.value) || 0))}
                                                    style={{ ...numStyle, textAlign: 'center', padding: '0.35rem 0.2rem' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {entry.note && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>AI 메모: {entry.note}</p>}

                        {/* 최종 합계 (인원/먹은양 반영) */}
                        <div style={{ background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: '10px', padding: '0.85rem' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                실제 저장될 1인분 ({entry.people}명 ÷, {entry.portionPct}% 반영)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                <span style={{ color: '#EB5757' }}>{totals.calories} kcal</span>
                                <span>탄 {totals.carbs}g</span>
                                <span>단 {totals.protein}g</span>
                                <span>지 {totals.fat}g</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {isMulti ? (
                                <button onClick={goNext} style={{ ...secondaryBtn, flex: 1 }}>
                                    <SkipForward size={15} /> 건너뛰기
                                </button>
                            ) : (
                                <button onClick={reset} style={{ ...secondaryBtn, flex: 1 }}>
                                    <RefreshCw size={15} /> 다시 촬영
                                </button>
                            )}
                            <button onClick={handleConfirm} disabled={!entry.items.length} style={{ ...primaryBtn, flex: 2, opacity: entry.items.length ? 1 : 0.5 }}>
                                <Check size={16} /> {entry.items.length}개 저장{hasNext ? ' 후 다음' : ''}
                            </button>
                        </div>
                    </div>
                )}

                {/* 여러 장: 나머지는 하나씩 확인하지 않고 AI 추정값 그대로 저장 */}
                {isMulti && hasNext && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <button
                            onClick={handleSaveAll}
                            disabled={restAnalyzing || !restDoneCount}
                            style={{ ...secondaryBtn, width: '100%', opacity: restAnalyzing || !restDoneCount ? 0.5 : 1 }}
                        >
                            {restAnalyzing
                                ? <><Loader2 size={15} className="spin" /> 나머지 사진 분석 중…</>
                                : <><Check size={15} /> 남은 사진 모두 저장 ({restDoneCount}장)</>}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem', textAlign: 'center' }}>
                            확인 안 한 사진은 1명·전부 기준으로, 촬영 시각이 있으면 그 날짜·끼니로 저장돼요.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const labelStyle = { fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.45rem' };
const stepBtn = {
    width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border-color)',
    background: '#161616', color: 'var(--text-primary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const primaryBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
    background: '#EB5757', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
};
const secondaryBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)',
    cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem',
};

export default PhotoMealModal;
