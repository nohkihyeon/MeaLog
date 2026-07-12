import React, { useState, useMemo } from 'react';
import { Scale, Settings, TrendingDown, Flame, CalendarDays } from 'lucide-react';

// ---- 목표 모드 정의 ----
const GOAL_MODES = {
    cut: { label: '감량', defaultTarget: -500 },
    maintain: { label: '유지', defaultTarget: 0 },
    bulk: { label: '증량', defaultTarget: 300 },
};

const COLOR_GOOD = '#27AE60';
const COLOR_BAD = '#EB5757';
const COLOR_WARN = '#F2C94C';

// 밸런스 값(섭취-소모)이 목표 모드 관점에서 좋은지 판정
const judgeBalance = (balance, mode) => {
    if (mode === 'cut') return balance <= 0 ? 'good' : 'bad';
    if (mode === 'bulk') return balance >= 0 ? 'good' : 'bad';
    // maintain: ±200 적정, ±400 주의, 그 밖은 이탈
    const abs = Math.abs(balance);
    if (abs <= 200) return 'good';
    if (abs <= 400) return 'warn';
    return 'bad';
};

const judgeColor = (verdict) =>
    verdict === 'good' ? COLOR_GOOD : verdict === 'warn' ? COLOR_WARN : COLOR_BAD;

// 하루가 목표를 달성했는지 판정
const meetsGoal = (balance, mode, target) => {
    if (mode === 'cut') return balance <= target;
    if (mode === 'bulk') return balance >= target;
    return Math.abs(balance - target) <= 200;
};

const fmtSigned = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v)).toLocaleString()}`;

// ---- 다이버징 바 차트 ----
const BalanceChart = ({ data, targetBalance, mode }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!data || data.length === 0) return null;

    const width = 500;
    const height = 180;
    const padLeft = 42;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 26;
    const plotH = height - padTop - padBottom;
    const zeroY = padTop + plotH / 2;
    const halfH = plotH / 2;

    const maxAbsRaw = Math.max(
        300,
        Math.abs(targetBalance),
        ...data.map(d => (d.validDays > 0 ? Math.abs(d.avgBalance) : 0))
    );
    const maxAbs = Math.ceil(maxAbsRaw / 100) * 100 * 1.1;

    const yFor = (v) => zeroY - (v / maxAbs) * halfH;

    const chartW = width - padLeft - padRight;
    const colWidth = chartW / data.length;
    const targetY = yFor(targetBalance);
    const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '1.25rem' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* 상/하한 그리드 */}
                {[maxAbs, -maxAbs].map((v, i) => (
                    <g key={i}>
                        <line
                            x1={padLeft} y1={yFor(v)} x2={width - padRight} y2={yFor(v)}
                            stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4"
                        />
                        <text x={padLeft - 8} y={yFor(v) + 3} fill="var(--text-tertiary)" fontSize="8" textAnchor="end">
                            {fmtSigned(v)}
                        </text>
                    </g>
                ))}

                {/* 목표선 */}
                {targetBalance !== 0 && (
                    <g>
                        <line
                            x1={padLeft} y1={targetY} x2={width - padRight} y2={targetY}
                            stroke={COLOR_GOOD} strokeWidth="1" strokeDasharray="2 4" opacity="0.8"
                        />
                        <text x={padLeft - 8} y={targetY + 3} fill={COLOR_GOOD} fontSize="8" textAnchor="end">
                            목표
                        </text>
                    </g>
                )}

                {/* 0 기준선 */}
                <line
                    x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY}
                    stroke="var(--text-tertiary)" strokeWidth="1"
                />
                <text x={padLeft - 8} y={zeroY + 3} fill="var(--text-tertiary)" fontSize="8" textAnchor="end">0</text>

                {/* 다이버징 바 */}
                {data.map((item, idx) => {
                    const cx = padLeft + idx * colWidth + colWidth / 2;
                    const isHovered = hoveredIndex === idx;
                    const barWidth = Math.min(colWidth * 0.45, 20);
                    const hasData = item.validDays > 0;

                    let bar = null;
                    if (hasData) {
                        const v = item.avgBalance;
                        const barH = Math.max(Math.abs((v / maxAbs) * halfH), 2);
                        const y = v >= 0 ? zeroY - barH : zeroY;
                        const color = judgeColor(judgeBalance(v, mode));
                        bar = (
                            <rect
                                x={cx - barWidth / 2}
                                y={y}
                                width={barWidth}
                                height={barH}
                                rx="3"
                                fill={color}
                                opacity={isHovered ? 1 : 0.75}
                                style={{ transition: 'opacity 0.2s ease' }}
                            />
                        );
                    } else {
                        bar = (
                            <line
                                x1={cx - barWidth / 2} y1={zeroY} x2={cx + barWidth / 2} y2={zeroY}
                                stroke="var(--text-tertiary)" strokeWidth="2" opacity="0.4"
                            />
                        );
                    }

                    return (
                        <g key={idx}>
                            {bar}
                            {/* 호버 트리거 */}
                            <rect
                                x={padLeft + idx * colWidth}
                                y={padTop}
                                width={colWidth}
                                height={plotH}
                                fill="transparent"
                                style={{ cursor: hasData ? 'pointer' : 'default' }}
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />
                            <text
                                x={cx}
                                y={height - 8}
                                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                                fontSize="9"
                                fontWeight={isHovered ? '600' : '400'}
                                textAnchor="middle"
                            >
                                {item.label}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* 툴팁 */}
            {hovered && hovered.validDays > 0 && (
                <div style={{
                    position: 'absolute',
                    left: `${((padLeft + hoveredIndex * colWidth + colWidth / 2) / width) * 100}%`,
                    top: 0,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', alignSelf: 'center', marginBottom: '2px' }}>
                        {hovered.periodLabel || hovered.label}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🍽️ 섭취</span>
                        <span>{Math.round(hovered.avgIntake).toLocaleString()} kcal</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🔥 소모</span>
                        <span>{Math.round(hovered.avgBurn).toLocaleString()} kcal</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>⚖️ 밸런스</span>
                        <span style={{ color: judgeColor(judgeBalance(hovered.avgBalance, mode)) }}>
                            {fmtSigned(hovered.avgBalance)} kcal
                        </span>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem', alignSelf: 'center', marginTop: '2px' }}>
                        밸런스 계산일: {hovered.validDays}일
                    </span>
                </div>
            )}
        </div>
    );
};

// ---- 요약 타일 ----
const MetricTile = ({ label, value, unit, sub, color, bg }) => (
    <div style={{
        flex: 1,
        minWidth: '140px',
        backgroundColor: bg || 'var(--bg-primary)',
        borderRadius: '12px',
        padding: '0.9rem 1rem',
    }}>
        <div style={{ fontSize: '0.75rem', color: color || 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2px', color: color || 'var(--text-primary)' }}>
            {value}
            <span style={{ fontSize: '0.75rem', fontWeight: 500, marginLeft: '4px', opacity: 0.8 }}>{unit}</span>
        </div>
        {sub && (
            <div style={{ fontSize: '0.7rem', marginTop: '2px', color: color || 'var(--text-tertiary)', opacity: color ? 0.85 : 1 }}>
                {sub}
            </div>
        )}
    </div>
);

const CalorieBalanceCard = ({ dailyData, dailyEnergy, viewType, manualBmr, onChangeManualBmr }) => {
    // ---- 설정 (localStorage 유지, manualBmr는 부모와 공유) ----
    const [goalMode, setGoalMode] = useState(() => {
        const saved = localStorage.getItem('mealog_goal_mode');
        return GOAL_MODES[saved] ? saved : 'cut';
    });
    const [targetBalance, setTargetBalance] = useState(() => {
        const saved = localStorage.getItem('mealog_target_balance');
        return saved !== null ? Number(saved) : GOAL_MODES.cut.defaultTarget;
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editMode, setEditMode] = useState(goalMode);
    const [editTarget, setEditTarget] = useState(targetBalance);
    const [editBmr, setEditBmr] = useState(manualBmr);

    const handleSave = () => {
        const mode = GOAL_MODES[editMode] ? editMode : 'cut';
        const target = Number.isFinite(Number(editTarget)) ? Number(editTarget) : GOAL_MODES[mode].defaultTarget;
        const bmr = Number(editBmr) > 0 ? Number(editBmr) : 1600;

        setGoalMode(mode);
        setTargetBalance(target);
        onChangeManualBmr(bmr);
        localStorage.setItem('mealog_goal_mode', mode);
        localStorage.setItem('mealog_target_balance', String(target));
        localStorage.setItem('mealog_manual_bmr', String(bmr));
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditMode(goalMode);
        setEditTarget(targetBalance);
        setEditBmr(manualBmr);
        setIsEditing(false);
    };

    // ---- 일별 소모 칼로리 맵: date → { burn, basal, active } ----
    const energyMap = useMemo(() => {
        const map = {};
        dailyEnergy.forEach(e => {
            const basal = e.basal > 0 ? e.basal : manualBmr; // 데이터 우선, 없으면 수동 BMR 폴백
            map[e.date] = { basal, active: e.active, burn: basal + e.active };
        });
        return map;
    }, [dailyEnergy, manualBmr]);

    // ---- 유효일(식단 + 에너지 데이터가 모두 있는 날)의 일별 밸런스 ----
    const balanceByDate = useMemo(() => {
        const map = {};
        Object.entries(dailyData).forEach(([date, d]) => {
            const energy = energyMap[date];
            if (!energy) return;
            map[date] = {
                intake: d.calories,
                burn: energy.burn,
                basal: energy.basal,
                active: energy.active,
                balance: d.calories - energy.burn,
            };
        });
        return map;
    }, [dailyData, energyMap]);

    const hasEnergyData = dailyEnergy.length > 0;
    const validDateCount = Object.keys(balanceByDate).length;

    // ---- 기간 집계 헬퍼 ----
    const aggregateRange = (dates) => {
        let intake = 0, burn = 0, basal = 0, active = 0, validDays = 0;
        dates.forEach(key => {
            const b = balanceByDate[key];
            if (!b) return;
            intake += b.intake;
            burn += b.burn;
            basal += b.basal;
            active += b.active;
            validDays += 1;
        });
        return {
            validDays,
            avgIntake: validDays ? intake / validDays : 0,
            avgBurn: validDays ? burn / validDays : 0,
            avgBasal: validDays ? basal / validDays : 0,
            avgActive: validDays ? active / validDays : 0,
            avgBalance: validDays ? (intake - burn) / validDays : 0,
        };
    };

    const dateKey = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // ---- viewType별 차트 데이터 (기존 리포트와 동일한 기간 구조) ----
    const report = useMemo(() => {
        const today = new Date();
        const chartData = [];

        if (viewType === 'day') {
            // 최근 14일, 하루 단위
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const allDates = [];

            for (let i = 13; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const key = dateKey(d);
                allDates.push(key);

                chartData.push({
                    label: i === 0 ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`,
                    periodLabel: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${dayNames[d.getDay()]})`,
                    totalDays: 1,
                    ...aggregateRange([key]),
                });
            }

            // 일간 요약은 14일 전체 평균
            const summary = { ...aggregateRange(allDates), totalDays: 14 };
            return { chartData, summary, periodName: '최근 14일' };
        }

        if (viewType === 'week') {
            const getMonday = (d) => {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(date.setDate(diff));
                monday.setHours(0, 0, 0, 0);
                return monday;
            };
            const currentMonday = getMonday(today);

            for (let i = 7; i >= 0; i--) {
                const monday = new Date(currentMonday);
                monday.setDate(currentMonday.getDate() - i * 7);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                const dates = [];
                for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
                    dates.push(dateKey(d));
                }

                chartData.push({
                    label: i === 0 ? '이번 주' : `${monday.getMonth() + 1}/${monday.getDate()}`,
                    periodLabel: `${monday.getFullYear()}.${monday.getMonth() + 1}.${monday.getDate()} ~ ${sunday.getMonth() + 1}.${sunday.getDate()}`,
                    totalDays: 7,
                    ...aggregateRange(dates),
                });
            }
        } else if (viewType === 'month') {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const year = d.getFullYear();
                const month = d.getMonth();
                const numDays = new Date(year, month + 1, 0).getDate();

                const dates = [];
                for (let dayNum = 1; dayNum <= numDays; dayNum++) {
                    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`);
                }

                chartData.push({
                    label: `${month + 1}월`,
                    periodLabel: `${year}년 ${month + 1}월`,
                    totalDays: numDays,
                    ...aggregateRange(dates),
                });
            }
        } else {
            const yearsMap = {};
            Object.keys(balanceByDate).forEach(key => { yearsMap[key.slice(0, 4)] = true; });
            let uniqueYears = Object.keys(yearsMap).sort();
            if (uniqueYears.length === 0) uniqueYears = [String(today.getFullYear())];

            uniqueYears.forEach(yStr => {
                const dates = Object.keys(balanceByDate).filter(key => key.startsWith(yStr));
                chartData.push({
                    label: `${yStr}년`,
                    periodLabel: `${yStr}년`,
                    totalDays: 365,
                    ...aggregateRange(dates),
                });
            });
        }

        // 요약: 데이터가 있는 가장 최근 기간
        let summary = chartData[chartData.length - 1] || { validDays: 0 };
        const periodName = viewType === 'week' ? '이번 주' : viewType === 'month' ? '이번 달' : '올해';

        return { chartData, summary, periodName };
    }, [balanceByDate, viewType]);

    // ---- 인사이트 ----
    const insights = useMemo(() => {
        const list = [];
        const entries = Object.entries(balanceByDate).sort((a, b) => a[0].localeCompare(b[0]));
        if (entries.length === 0) return list;

        // 1. 최근 30일 누적 밸런스 → 체지방 환산 (약 7,700 kcal ≈ 1kg)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffKey = dateKey(cutoff);
        const recent = entries.filter(([date]) => date >= cutoffKey);
        if (recent.length >= 3) {
            const cumulative = recent.reduce((sum, [, b]) => sum + b.balance, 0);
            const fatKg = Math.abs(cumulative) / 7700;
            const isDeficit = cumulative < 0;
            list.push({
                icon: TrendingDown,
                iconColor: isDeficit ? COLOR_GOOD : COLOR_BAD,
                text: `최근 30일 누적 밸런스는 [${fmtSigned(cumulative)} kcal]입니다. 체지방 약 [${fatKg.toFixed(1)}kg] ${isDeficit ? '감량' : '증량'}에 해당해요. (계산일 ${recent.length}일 기준)`,
            });
        }

        // 2. 목표 달성 연속 스트릭 (가장 최근 계산일부터 역순)
        let streak = 0;
        for (let i = entries.length - 1; i >= 0; i--) {
            if (meetsGoal(entries[i][1].balance, goalMode, targetBalance)) streak += 1;
            else break;
        }
        if (streak >= 2) {
            list.push({
                icon: Flame,
                iconColor: '#F2994A',
                text: `목표 밸런스(${fmtSigned(targetBalance)} kcal) 달성 [${streak}일 연속] 스트릭 진행 중입니다!`,
            });
        }

        // 3. 흑자(과잉)가 가장 잦은 요일
        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const byDow = Array(7).fill(0).map(() => ({ sum: 0, count: 0 }));
        entries.forEach(([date, b]) => {
            const idx = new Date(date).getDay();
            byDow[idx].sum += b.balance;
            byDow[idx].count += 1;
        });
        let maxIdx = -1, maxAvg = -Infinity;
        byDow.forEach((d, idx) => {
            if (d.count > 0) {
                const avg = d.sum / d.count;
                if (avg > maxAvg) { maxAvg = avg; maxIdx = idx; }
            }
        });
        if (maxIdx !== -1) {
            list.push({
                icon: CalendarDays,
                iconColor: 'var(--accent-secondary)',
                text: `밸런스가 가장 높은(과식 주의) 요일은 평균 [${fmtSigned(maxAvg)} kcal]인 [${dayNames[maxIdx]}]입니다.`,
            });
        }

        return list;
    }, [balanceByDate, goalMode, targetBalance]);

    const { summary, chartData, periodName } = report;
    const summaryVerdict = judgeBalance(summary.avgBalance || 0, goalMode);
    const summaryColor = judgeColor(summaryVerdict);

    // 목표 달성률: 목표 대비 밸런스 비율 (감량이면 적자 깊이 / 목표 적자)
    const achievement = (() => {
        if (!summary.validDays) return null;
        if (goalMode === 'maintain') {
            return meetsGoal(summary.avgBalance, 'maintain', targetBalance) ? '목표 범위 유지 중' : '목표 범위 이탈';
        }
        if (targetBalance === 0) return null;
        const pct = Math.round((summary.avgBalance / targetBalance) * 100);
        if (pct < 0) return goalMode === 'cut' ? '흑자 상태 — 목표 미달' : '적자 상태 — 목표 미달';
        return `목표 달성률 ${Math.min(pct, 999)}%${pct >= 100 ? ' · 달성!' : ''}`;
    })();

    const verdictWord = summary.avgBalance <= 0 ? '적자' : '흑자';

    return (
        <div className="apple-card" style={{ marginBottom: '2rem' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div className="apple-card-title" style={{ margin: 0 }}>
                    <Scale size={18} color={COLOR_GOOD} />
                    <span>칼로리 밸런스 ({periodName})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        backgroundColor: 'rgba(39, 174, 96, 0.12)',
                        color: COLOR_GOOD,
                    }}>
                        {GOAL_MODES[goalMode].label} 모드 · 목표 {fmtSigned(targetBalance)}
                    </span>
                    {!isEditing && (
                        <Settings
                            size={16}
                            color="var(--text-secondary)"
                            style={{ cursor: 'pointer', opacity: 0.7 }}
                            onClick={() => {
                                setEditMode(goalMode);
                                setEditTarget(targetBalance);
                                setEditBmr(manualBmr);
                                setIsEditing(true);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* 설정 패널 */}
            {isEditing && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>목표 모드</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {Object.entries(GOAL_MODES).map(([key, m]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setEditMode(key);
                                        setEditTarget(m.defaultTarget);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.4rem',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        border: `1px solid ${editMode === key ? COLOR_GOOD : 'var(--border-color)'}`,
                                        backgroundColor: editMode === key ? 'rgba(39, 174, 96, 0.12)' : 'transparent',
                                        color: editMode === key ? COLOR_GOOD : 'var(--text-secondary)',
                                    }}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>목표 일일 밸런스 (kcal)</label>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={editTarget}
                                onChange={e => setEditTarget(e.target.value === '' ? '' : Number(e.target.value))}
                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>기초대사량 (kcal)</label>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={editBmr}
                                onChange={e => setEditBmr(e.target.value === '' ? '' : Number(e.target.value))}
                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>
                        기초대사량은 건강 데이터에 기초 칼로리가 없는 날에만 대신 사용됩니다.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem',
                                fontWeight: 600, backgroundColor: COLOR_GOOD, color: '#fff',
                            }}
                        >
                            저장
                        </button>
                        <button
                            onClick={handleCancel}
                            style={{
                                flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem',
                                fontWeight: 600, backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}

            {!hasEnergyData ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                    소모 칼로리(daily_energy) 데이터가 아직 없습니다. 동기화 로그인 후 건강 데이터를 업로드하면 칼로리 적자/흑자 분석이 표시됩니다.
                </p>
            ) : validDateCount === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                    식단 기록과 소모 칼로리 데이터가 겹치는 날이 없어 밸런스를 계산할 수 없습니다.
                </p>
            ) : (
                <>
                    {/* 요약 타일 */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                        <MetricTile
                            label="일평균 섭취"
                            value={Math.round(summary.avgIntake || 0).toLocaleString()}
                            unit="kcal"
                            sub={`밸런스 계산일 ${summary.validDays}/${summary.totalDays || 0}일`}
                        />
                        <MetricTile
                            label="일평균 소모"
                            value={Math.round(summary.avgBurn || 0).toLocaleString()}
                            unit="kcal"
                            sub={`기초 ${Math.round(summary.avgBasal || 0).toLocaleString()} + 활동 ${Math.round(summary.avgActive || 0).toLocaleString()}`}
                        />
                        <MetricTile
                            label={`평균 밸런스 (${verdictWord})`}
                            value={fmtSigned(summary.avgBalance || 0)}
                            unit="kcal"
                            sub={achievement}
                            color={summary.validDays ? summaryColor : undefined}
                            bg={summary.validDays ? `${summaryColor}1F` : undefined}
                        />
                    </div>

                    {/* 다이버징 차트 */}
                    <BalanceChart data={chartData} targetBalance={targetBalance} mode={goalMode} />

                    {/* 밸런스 인사이트 */}
                    {insights.length > 0 && (
                        <div style={{
                            borderTop: '1px solid var(--border-color)',
                            marginTop: '1.25rem',
                            paddingTop: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                        }}>
                            {insights.map((insight, idx) => {
                                const Icon = insight.icon;
                                return (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        <Icon size={15} color={insight.iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <p style={{ margin: 0 }}>
                                            {insight.text.split(/\[(.*?)\]/g).map((part, i) =>
                                                i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong> : part
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CalorieBalanceCard;
