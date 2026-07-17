import React, { useState } from 'react';
import { X, Minus, Plus, Check, Sparkles } from 'lucide-react';
import { round1 } from '../utils/nutrition';

// AI 이름 검색 결과가 "애매"할 때 뜨는 양(g) 확인 팝업.
// ± 버튼/직접입력으로 g 을 조절하면 탄단지·칼로리가 비례해서 실시간 갱신된다.
// onConfirm(grams) 로 확정한다.

const STEP = 25; // ± 한 번에 25g

const AI_COLOR = '#BB6BD9';

const AiFoodModal = ({ name, question, servingG, per100, onConfirm, onClose }) => {
    const [grams, setGrams] = useState(servingG);

    const scale = grams / 100;
    const vals = {
        calories: Math.round((per100.calories_kcal || 0) * scale),
        carbs: round1((per100.carbs_g || 0) * scale),
        protein: round1((per100.protein_g || 0) * scale),
        fat: round1((per100.fat_g || 0) * scale),
    };

    const bump = (dir) => setGrams((g) => Math.max(STEP, Math.round((g + dir * STEP) / STEP) * STEP));

    return (
        <div
            onClick={onClose}
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
                    width: '100%', maxWidth: '360px', padding: '1.4rem',
                    border: '1px solid var(--border-color)', backgroundColor: '#1E1E1E',
                    borderRadius: '14px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Sparkles size={16} color={AI_COLOR} /> AI 영양 추정
                    </h2>
                    <button onClick={onClose} aria-label="닫기"><X size={20} color="var(--text-secondary)" /></button>
                </div>

                {/* AI의 되묻기 */}
                <div style={{
                    background: 'rgba(187,107,217,0.08)', border: '1px solid rgba(187,107,217,0.3)',
                    borderRadius: '10px', padding: '0.8rem 0.9rem', marginBottom: '1rem',
                    fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)',
                }}>
                    {question || `${name}, ${servingG}g 정도 드셨나요?`}
                </div>

                {/* 양 조절 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
                    <button onClick={() => bump(-1)} aria-label={`${STEP}g 줄이기`} style={stepBtn}><Minus size={16} /></button>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                        <input
                            type="number" inputMode="numeric" min="1" value={grams}
                            onChange={(e) => setGrams(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                            style={{
                                width: '84px', padding: '0.45rem 0.4rem', fontSize: '1.15rem', fontWeight: 700,
                                textAlign: 'center', background: '#161616', border: '1px solid var(--border-color)',
                                borderRadius: '8px', color: 'var(--text-primary)',
                            }}
                        />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>g</span>
                    </div>
                    <button onClick={() => bump(1)} aria-label={`${STEP}g 늘리기`} style={stepBtn}><Plus size={16} /></button>
                </div>

                {/* 비례 계산된 탄단지·칼로리 미리보기 */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem',
                    marginBottom: '1.1rem',
                }}>
                    {[
                        ['🔥', `${vals.calories}`, 'kcal', '#EB5757'],
                        ['🍚', `${vals.carbs}`, '탄 g', 'var(--text-primary)'],
                        ['💪', `${vals.protein}`, '단 g', 'var(--text-primary)'],
                        ['🥑', `${vals.fat}`, '지 g', 'var(--text-primary)'],
                    ].map(([emoji, v, lbl, color]) => (
                        <div key={lbl} style={{
                            background: '#161616', border: '1px solid var(--border-color)', borderRadius: '10px',
                            padding: '0.55rem 0.2rem', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '0.75rem' }}>{emoji}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color }}>{v}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{lbl}</div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => onConfirm(grams)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.7rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: AI_COLOR, color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                    }}
                >
                    <Check size={16} /> {grams}g 로 채우기
                </button>
            </div>
        </div>
    );
};

const stepBtn = {
    width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--border-color)',
    background: '#161616', color: 'var(--text-primary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default AiFoodModal;
