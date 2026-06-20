import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Minus, Plus, Trash2, Check, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { analyzeFoodImage, hasGeminiKey } from '../utils/gemini';

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

const defaultMealType = () => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
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
    const [step, setStep] = useState('select'); // select | analyzing | review | error
    const [imageUrl, setImageUrl] = useState(null);
    const [items, setItems] = useState([]);
    const [note, setNote] = useState('');
    const [people, setPeople] = useState(1);
    const [portionPct, setPortionPct] = useState(100);
    const [mealType, setMealType] = useState(defaultMealType);
    const [errorMsg, setErrorMsg] = useState('');
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);

    if (!isOpen) return null;

    const factor = (portionPct / 100) / Math.max(1, people);
    const adj = (v) => Math.round((Number(v) || 0) * factor);

    const totals = items.reduce(
        (a, it) => ({
            calories: a.calories + adj(it.calories_kcal),
            carbs: a.carbs + adj(it.carbs_g),
            protein: a.protein + adj(it.protein_g),
            fat: a.fat + adj(it.fat_g),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );

    const reset = () => {
        setStep('select');
        setImageUrl(null);
        setItems([]);
        setNote('');
        setPeople(1);
        setPortionPct(100);
        setErrorMsg('');
    };

    const close = () => {
        reset();
        onClose();
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const dataUrl = await resizeImage(file);
            setImageUrl(dataUrl);
            setStep('analyzing');
            setErrorMsg('');
            const result = await analyzeFoodImage(dataUrl);
            if (!result.items.length) {
                setErrorMsg('사진에서 음식을 찾지 못했어요. 다른 사진으로 시도해보세요.');
                setStep('error');
                return;
            }
            setItems(result.items);
            setNote(result.note || '');
            setStep('review');
        } catch (err) {
            console.error('분석 실패', err);
            setErrorMsg(err.message || '분석 중 오류가 발생했습니다.');
            setStep('error');
        }
    };

    const updateItem = (idx, key, value) => {
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
    };

    const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

    const handleConfirm = () => {
        const meals = items.map((it) => {
            const w = adj(it.weight_g);
            const baseName = it.name || '음식';
            return {
                name: w > 0 ? `${baseName} (${w}g)` : baseName,
                type: mealType,
                calories: adj(it.calories_kcal),
                protein: adj(it.protein_g),
                carbs: adj(it.carbs_g),
                fat: adj(it.fat_g),
            };
        });
        onConfirm(meals);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={18} color="#EB5757" /> 사진으로 식단 추가
                    </h2>
                    <button onClick={close} aria-label="닫기"><X size={22} color="var(--text-secondary)" /></button>
                </div>

                {/* STEP: SELECT */}
                {step === 'select' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            음식 사진을 올리면 AI가 음식·무게·탄단지·칼로리를 추정해요.
                            결과는 저장 전에 직접 확인하고 수정할 수 있어요.
                        </p>
                        {noKey && (
                            <div style={{ background: '#3a2a12', border: '1px solid #6b4a1a', color: '#f1c27d', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                ⚠️ Gemini API 키가 없어요. <code>.env</code>에 <code>VITE_GEMINI_API_KEY</code>를 넣고 앱을 다시 시작하세요.
                            </div>
                        )}
                        {/* 촬영: capture로 카메라 직행 / 앨범·파일: capture 없이 네이티브 선택기 */}
                        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
                        <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
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
                                <span style={{ fontSize: '0.75rem' }}>갤러리/파일에서 선택</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP: ANALYZING */}
                {step === 'analyzing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1.5rem 0' }}>
                        {imageUrl && <img src={imageUrl} alt="음식" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '10px' }} />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
                            <Loader2 size={20} className="spin" />
                            <span>AI가 음식을 분석하는 중…</span>
                        </div>
                        <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                )}

                {/* STEP: ERROR */}
                {step === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem 0' }}>
                        <p style={{ color: '#EB5757', textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.5 }}>{errorMsg}</p>
                        <button onClick={reset} style={primaryBtn}>
                            <RefreshCw size={16} /> 다시 시도
                        </button>
                    </div>
                )}

                {/* STEP: REVIEW (HIL) */}
                {step === 'review' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        <div style={{ background: '#161616', borderRadius: '10px', padding: '0.75rem 0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {imageUrl && <img src={imageUrl} alt="음식" style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '8px' }} />}
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                <strong>이거 드신 거 맞나요?</strong>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>아래 값을 확인하고 필요하면 수정하세요.</div>
                            </div>
                        </div>

                        {/* 끼니 종류 */}
                        <div>
                            <div style={labelStyle}>끼니</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {MEAL_TYPES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setMealType(t.id)}
                                        style={{
                                            padding: '0.35rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer',
                                            border: `1px solid ${mealType === t.id ? t.color : 'var(--border-color)'}`,
                                            background: mealType === t.id ? t.color : 'transparent',
                                            color: mealType === t.id ? '#111' : 'var(--text-secondary)', fontWeight: 600,
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
                                <button onClick={() => setPeople((p) => Math.max(1, p - 1))} style={stepBtn} aria-label="인원 감소"><Minus size={16} /></button>
                                <input
                                    type="number" min="1" value={people}
                                    onChange={(e) => setPeople(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                                    style={{ ...numStyle, width: '60px', textAlign: 'center' }}
                                />
                                <button onClick={() => setPeople((p) => p + 1)} style={stepBtn} aria-label="인원 증가"><Plus size={16} /></button>
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
                                        onClick={() => setPortionPct(p.value)}
                                        style={{
                                            flex: 1, padding: '0.45rem 0', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
                                            border: `1px solid ${portionPct === p.value ? '#EB5757' : 'var(--border-color)'}`,
                                            background: portionPct === p.value ? 'rgba(235,87,87,0.15)' : 'transparent',
                                            color: portionPct === p.value ? '#EB5757' : 'var(--text-secondary)', fontWeight: 600,
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 항목별 영양 정보 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {items.map((it, idx) => (
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
                                                    type="number" min="0" value={it[key]}
                                                    onChange={(e) => updateItem(idx, key, Math.max(0, Number(e.target.value) || 0))}
                                                    style={{ ...numStyle, textAlign: 'center', padding: '0.35rem 0.2rem' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {note && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>AI 메모: {note}</p>}

                        {/* 최종 합계 (인원/먹은양 반영) */}
                        <div style={{ background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.3)', borderRadius: '10px', padding: '0.85rem' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                실제 저장될 1인분 ({people}명 ÷, {portionPct}% 반영)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.2rem', fontSize: '0.9rem', fontWeight: 600 }}>
                                <span style={{ color: '#EB5757' }}>{totals.calories} kcal</span>
                                <span>탄 {totals.carbs}g</span>
                                <span>단 {totals.protein}g</span>
                                <span>지 {totals.fat}g</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button onClick={reset} style={{ ...secondaryBtn, flex: 1 }}>
                                <RefreshCw size={15} /> 다시 촬영
                            </button>
                            <button onClick={handleConfirm} disabled={!items.length} style={{ ...primaryBtn, flex: 2, opacity: items.length ? 1 : 0.5 }}>
                                <Check size={16} /> {items.length}개 저장
                            </button>
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
