import React, { useState, useMemo } from 'react';
import { Activity, Trophy, TrendingUp, TrendingDown, Sigma } from 'lucide-react';

const ACTIVE_COLOR = '#F2994A';
const BASAL_COLOR = 'rgba(155, 81, 224, 0.55)';
const BASAL_SOLID = '#9B51E0';

// 단위별 기간 옵션. days는 옵션 표시 여부(데이터 스팬 대비) 판정에도 쓰인다.
const UNITS = [
    { key: 'day', label: '일' },
    { key: 'week', label: '주' },
    { key: 'month', label: '월' },
    { key: 'year', label: '년' },
];

const RANGE_OPTIONS = {
    day: [
        { key: '30d', label: '30일', days: 30 },
        { key: '90d', label: '90일', days: 90 },
        { key: '180d', label: '180일', days: 180 },
    ],
    week: [
        { key: '12w', label: '12주', days: 84, weeks: 12 },
        { key: '26w', label: '26주', days: 182, weeks: 26 },
        { key: '52w', label: '52주', days: 364, weeks: 52 },
    ],
    month: [
        { key: '12m', label: '1년', days: 365, months: 12 },
        { key: '24m', label: '2년', days: 730, months: 24 },
        { key: '60m', label: '5년', days: 1825, months: 60 },
        { key: 'all', label: '전체', days: Infinity },
    ],
    year: [
        { key: 'all', label: '전체', days: Infinity },
    ],
};

const METRICS = [
    { key: 'total', label: '총 소모' },
    { key: 'active', label: '활동' },
    { key: 'basal', label: '기초' },
];

const dateKey = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// ---- 스택/단일 바 차트 (버킷 수가 많아도 동작하도록 라벨은 듬성듬성) ----
const EnergyChart = ({ buckets, metric, showMA }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!buckets || buckets.length === 0) return null;

    const width = 520;
    const height = 190;
    const padLeft = 40;
    const padRight = 10;
    const padTop = 14;
    const padBottom = 26;
    const plotH = height - padTop - padBottom;

    const valueOf = (b) =>
        b.recorded === 0 ? null :
        metric === 'total' ? b.avgTotal :
        metric === 'active' ? b.avgActive : b.avgBasal;

    const values = buckets.map(valueOf).filter(v => v != null);
    if (values.length === 0) return null;
    const maxVal = Math.max(...values, 100) * 1.08;

    const chartW = width - padLeft - padRight;
    const n = buckets.length;
    const colWidth = chartW / n;
    const barWidth = Math.max(Math.min(colWidth * 0.65, 20), 1.2);
    const labelStep = Math.ceil(n / 8);

    const yFor = (v) => padTop + plotH - (v / maxVal) * plotH;

    // 7버킷 이동평균 (일 단위 전용) — 결측 구간은 선을 끊는다
    let maPath = '';
    if (showMA) {
        let pen = false;
        buckets.forEach((b, idx) => {
            const windowVals = [];
            for (let k = Math.max(0, idx - 6); k <= idx; k++) {
                const v = valueOf(buckets[k]);
                if (v != null) windowVals.push(v);
            }
            if (valueOf(b) == null || windowVals.length < 4) { pen = false; return; }
            const avg = windowVals.reduce((s, v) => s + v, 0) / windowVals.length;
            const pt = `${padLeft + idx * colWidth + colWidth / 2},${yFor(avg)}`;
            maPath += pen ? ` L ${pt}` : ` M ${pt}`;
            pen = true;
        });
    }

    const hovered = hoveredIndex !== null ? buckets[hoveredIndex] : null;

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '1.25rem' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = padTop + (1 - ratio) * plotH;
                    return (
                        <g key={idx}>
                            <line
                                x1={padLeft} y1={y} x2={width - padRight} y2={y}
                                stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4"
                            />
                            <text x={padLeft - 8} y={y + 3} fill="var(--text-tertiary)" fontSize="8" textAnchor="end">
                                {Math.round(maxVal * ratio).toLocaleString()}
                            </text>
                        </g>
                    );
                })}

                {buckets.map((b, idx) => {
                    const x = padLeft + idx * colWidth + (colWidth - barWidth) / 2;
                    const cx = padLeft + idx * colWidth + colWidth / 2;
                    const isHovered = hoveredIndex === idx;
                    const hasData = b.recorded > 0;
                    const showLabel = idx % labelStep === 0 || idx === n - 1;

                    let bars = null;
                    if (hasData) {
                        if (metric === 'total') {
                            const basalH = (b.avgBasal / maxVal) * plotH;
                            const activeH = (b.avgActive / maxVal) * plotH;
                            const yActive = padTop + plotH - basalH - activeH;
                            bars = (
                                <>
                                    <rect
                                        x={x} y={padTop + plotH - basalH}
                                        width={barWidth} height={Math.max(basalH, 1)}
                                        fill={BASAL_COLOR}
                                        opacity={isHovered ? 1 : 0.85}
                                    />
                                    <rect
                                        x={x} y={yActive}
                                        width={barWidth} height={Math.max(activeH, 1)}
                                        rx={barWidth > 4 ? 2 : 0}
                                        fill={ACTIVE_COLOR}
                                        opacity={isHovered ? 1 : 0.85}
                                    />
                                </>
                            );
                        } else {
                            const v = valueOf(b);
                            const h = (v / maxVal) * plotH;
                            bars = (
                                <rect
                                    x={x} y={padTop + plotH - h}
                                    width={barWidth} height={Math.max(h, 1)}
                                    rx={barWidth > 4 ? 2 : 0}
                                    fill={metric === 'active' ? ACTIVE_COLOR : BASAL_SOLID}
                                    opacity={isHovered ? 1 : 0.8}
                                />
                            );
                        }
                    }

                    return (
                        <g key={idx}>
                            {bars}
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
                            {showLabel && (
                                <text
                                    x={cx}
                                    y={height - 8}
                                    fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                                    fontSize="8.5"
                                    textAnchor="middle"
                                >
                                    {b.label}
                                </text>
                            )}
                        </g>
                    );
                })}

                {showMA && maPath && (
                    <path
                        d={maPath}
                        fill="none"
                        stroke="var(--text-primary)"
                        strokeWidth="1.5"
                        opacity="0.55"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
            </svg>

            {/* 범례 */}
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {metric === 'total' ? (
                    <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: BASAL_COLOR }} />기초
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: ACTIVE_COLOR }} />활동
                        </span>
                    </>
                ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: metric === 'active' ? ACTIVE_COLOR : BASAL_SOLID }} />
                        {metric === 'active' ? '활동 칼로리' : '기초 칼로리'}
                    </span>
                )}
                {showMA && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '12px', height: '2px', backgroundColor: 'var(--text-primary)', opacity: 0.55 }} />7일 이동평균
                    </span>
                )}
            </div>

            {/* 툴팁 */}
            {hovered && hovered.recorded > 0 && (
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
                        {hovered.periodLabel}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🔥 총 소모</span>
                        <span>{Math.round(hovered.avgTotal).toLocaleString()} kcal</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🏃 활동</span>
                        <span style={{ color: ACTIVE_COLOR }}>{Math.round(hovered.avgActive).toLocaleString()} kcal</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>💤 기초</span>
                        <span style={{ color: BASAL_SOLID }}>{Math.round(hovered.avgBasal).toLocaleString()} kcal</span>
                    </div>
                    {hovered.totalDays > 1 && (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem', alignSelf: 'center', marginTop: '2px' }}>
                            기록일: {hovered.recorded}/{hovered.totalDays}일 (일평균)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

const Tile = ({ label, value, unit, sub, color }) => (
    <div style={{
        flex: 1,
        minWidth: '130px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        padding: '0.85rem 1rem',
    }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '2px', color: color || 'var(--text-primary)' }}>
            {value}
            <span style={{ fontSize: '0.72rem', fontWeight: 500, marginLeft: '3px', color: 'var(--text-tertiary)' }}>{unit}</span>
        </div>
        {sub && <div style={{ fontSize: '0.68rem', marginTop: '2px', color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
);

const EnergyDashboard = ({ dailyEnergy }) => {
    const [unit, setUnit] = useState('week');
    const [rangeKey, setRangeKey] = useState('26w');
    const [metric, setMetric] = useState('total');

    // 기초값이 없는 날 폴백용 BMR (통계 리포트의 설정과 동일 키 공유)
    const [manualBmr] = useState(() => {
        const saved = localStorage.getItem('mealog_manual_bmr');
        return saved !== null ? Number(saved) : 1600;
    });

    // date → { active, basal(폴백 적용), total }
    const energyMap = useMemo(() => {
        const map = {};
        dailyEnergy.forEach(e => {
            const basal = e.basal > 0 ? e.basal : manualBmr;
            map[e.date] = { active: e.active, basal, total: basal + e.active };
        });
        return map;
    }, [dailyEnergy, manualBmr]);

    const { minDateStr, spanDays } = useMemo(() => {
        if (dailyEnergy.length === 0) return { minDateStr: null, spanDays: 0 };
        let min = dailyEnergy[0].date;
        dailyEnergy.forEach(e => { if (e.date < min) min = e.date; });
        const diff = Math.floor((new Date(dateKey(new Date())) - new Date(min)) / 86400000) + 1;
        return { minDateStr: min, spanDays: diff };
    }, [dailyEnergy]);

    // 데이터 스팬을 넘어서는 기간 옵션은 화면에서 숨긴다 (최소 1개는 유지)
    const visibleRanges = useMemo(() => {
        const opts = RANGE_OPTIONS[unit];
        const finite = opts.filter(o => Number.isFinite(o.days));
        const visibleFinite = finite.filter((o, idx) => idx === 0 || o.days <= spanDays * 1.15);
        const largestFinite = visibleFinite.length ? visibleFinite[visibleFinite.length - 1].days : 0;
        const result = [...visibleFinite];
        opts.filter(o => !Number.isFinite(o.days)).forEach(o => {
            if (result.length === 0 || spanDays > largestFinite) result.push(o);
        });
        return result;
    }, [unit, spanDays]);

    const range = visibleRanges.find(r => r.key === rangeKey) || visibleRanges[Math.min(1, visibleRanges.length - 1)];

    const handleUnitChange = (u) => {
        setUnit(u);
        const opts = RANGE_OPTIONS[u];
        const finite = opts.filter((o, idx) => idx === 0 || !Number.isFinite(o.days) || o.days <= spanDays * 1.15);
        const def = finite[Math.min(1, finite.length - 1)];
        setRangeKey(def.key);
    };

    // ---- 버킷 생성 ----
    const buckets = useMemo(() => {
        if (dailyEnergy.length === 0 || !range) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const aggregate = (dates) => {
            let active = 0, basal = 0, recorded = 0;
            dates.forEach(key => {
                const e = energyMap[key];
                if (!e) return;
                active += e.active;
                basal += e.basal;
                recorded += 1;
            });
            return {
                recorded,
                avgActive: recorded ? active / recorded : 0,
                avgBasal: recorded ? basal / recorded : 0,
                avgTotal: recorded ? (active + basal) / recorded : 0,
            };
        };

        const result = [];

        if (unit === 'day') {
            for (let i = range.days - 1; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const key = dateKey(d);
                result.push({
                    label: `${d.getMonth() + 1}/${d.getDate()}`,
                    periodLabel: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${DAY_NAMES[d.getDay()]})`,
                    totalDays: 1,
                    ...aggregate([key]),
                });
            }
        } else if (unit === 'week') {
            const day = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
            for (let i = range.weeks - 1; i >= 0; i--) {
                const start = new Date(monday);
                start.setDate(monday.getDate() - i * 7);
                const dates = [];
                for (let k = 0; k < 7; k++) {
                    const d = new Date(start);
                    d.setDate(start.getDate() + k);
                    dates.push(dateKey(d));
                }
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                result.push({
                    label: `${start.getMonth() + 1}/${start.getDate()}`,
                    periodLabel: `${start.getFullYear()}.${start.getMonth() + 1}.${start.getDate()} ~ ${end.getMonth() + 1}.${end.getDate()}`,
                    totalDays: 7,
                    ...aggregate(dates),
                });
            }
        } else if (unit === 'month') {
            let numMonths;
            if (Number.isFinite(range.days)) {
                numMonths = range.months;
            } else {
                const min = new Date(minDateStr);
                numMonths = (today.getFullYear() - min.getFullYear()) * 12 + (today.getMonth() - min.getMonth()) + 1;
            }
            for (let i = numMonths - 1; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const year = d.getFullYear();
                const month = d.getMonth();
                const numDays = new Date(year, month + 1, 0).getDate();
                const dates = [];
                for (let k = 1; k <= numDays; k++) {
                    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(k).padStart(2, '0')}`);
                }
                result.push({
                    label: month === 0 ? `${String(year).slice(2)}.1` : `${month + 1}월`,
                    periodLabel: `${year}년 ${month + 1}월`,
                    totalDays: numDays,
                    ...aggregate(dates),
                });
            }
        } else {
            const minYear = Number(minDateStr.slice(0, 4));
            for (let y = minYear; y <= today.getFullYear(); y++) {
                const dates = Object.keys(energyMap).filter(k => k.startsWith(String(y)));
                result.push({
                    label: `${y}년`,
                    periodLabel: `${y}년`,
                    totalDays: 365,
                    ...aggregate(dates),
                });
            }
        }

        return result;
    }, [dailyEnergy, energyMap, unit, range, minDateStr]);

    // ---- 선택 범위 내 일 단위 통계 (요약 카드/인사이트용) ----
    const rangeStats = useMemo(() => {
        if (dailyEnergy.length === 0 || !range) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalDays = Number.isFinite(range.days)
            ? range.days
            : Math.floor((today - new Date(minDateStr)) / 86400000) + 1;
        const start = new Date(today);
        start.setDate(today.getDate() - totalDays + 1);
        const startKey = dateKey(start);

        const days = [];
        Object.entries(energyMap).forEach(([date, e]) => {
            if (date >= startKey) days.push({ date, ...e });
        });
        days.sort((a, b) => a.date.localeCompare(b.date));
        if (days.length === 0) return { recorded: 0, totalDays };

        const sumActive = days.reduce((s, d) => s + d.active, 0);
        const sumTotal = days.reduce((s, d) => s + d.total, 0);
        const best = days.reduce((m, d) => (d.active > m.active ? d : m), days[0]);

        // 요일별 평균 활동
        const byDow = Array(7).fill(0).map(() => ({ sum: 0, count: 0 }));
        days.forEach(d => {
            const idx = new Date(d.date).getDay();
            byDow[idx].sum += d.active;
            byDow[idx].count += 1;
        });
        let bestDow = -1, bestDowAvg = -Infinity;
        byDow.forEach((d, idx) => {
            if (d.count > 0 && d.sum / d.count > bestDowAvg) {
                bestDowAvg = d.sum / d.count;
                bestDow = idx;
            }
        });

        // 전반부 vs 후반부 추세
        let trendPct = null;
        const half = Math.floor(days.length / 2);
        if (half >= 5) {
            const firstAvg = days.slice(0, half).reduce((s, d) => s + d.total, 0) / half;
            const secondAvg = days.slice(half).reduce((s, d) => s + d.total, 0) / (days.length - half);
            if (firstAvg > 0) trendPct = ((secondAvg - firstAvg) / firstAvg) * 100;
        }

        return {
            recorded: days.length,
            totalDays,
            avgTotal: sumTotal / days.length,
            avgActive: sumActive / days.length,
            sumActive,
            best,
            bestDow,
            bestDowAvg,
            trendPct,
        };
    }, [dailyEnergy, energyMap, range, minDateStr]);

    if (dailyEnergy.length === 0) return null;

    const bestDate = rangeStats?.best ? new Date(rangeStats.best.date) : null;

    return (
        <div className="stats-dashboard">
            <div className="stats-header">
                <h1 className="stats-title">에너지 대시보드</h1>

                <div className="segmented-control">
                    {UNITS.map(u => (
                        <button
                            key={u.key}
                            className={`segmented-button ${unit === u.key ? 'active' : ''}`}
                            onClick={() => handleUnitChange(u.key)}
                        >
                            {u.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="apple-card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                        <div className="apple-card-title" style={{ marginBottom: '0.25rem' }}>
                            <Activity size={18} color={ACTIVE_COLOR} />
                            <span>소모 칼로리 추이</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {range?.label} 동안의 {unit === 'day' ? '일별' : unit === 'week' ? '주별' : unit === 'month' ? '월별' : '연도별'} {unit === 'day' ? '소모량' : '일평균 소모량'}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* 기간 칩 — 데이터 스팬을 넘는 옵션은 숨김 */}
                        {visibleRanges.length > 1 && visibleRanges.map(r => (
                            <button
                                key={r.key}
                                onClick={() => setRangeKey(r.key)}
                                style={{
                                    padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                    border: '1px solid var(--border-color)', cursor: 'pointer',
                                    backgroundColor: range?.key === r.key ? 'rgba(242, 153, 74, 0.15)' : 'transparent',
                                    color: range?.key === r.key ? ACTIVE_COLOR : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {r.label}
                            </button>
                        ))}
                        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
                        {/* 지표 칩 */}
                        {METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMetric(m.key)}
                                style={{
                                    padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                    border: '1px solid var(--border-color)', cursor: 'pointer',
                                    backgroundColor: metric === m.key ? 'rgba(155, 81, 224, 0.15)' : 'transparent',
                                    color: metric === m.key ? BASAL_SOLID : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 요약 타일 */}
                {rangeStats && rangeStats.recorded > 0 && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                        <Tile
                            label="일평균 총 소모"
                            value={Math.round(rangeStats.avgTotal).toLocaleString()}
                            unit="kcal"
                        />
                        <Tile
                            label="일평균 활동"
                            value={Math.round(rangeStats.avgActive).toLocaleString()}
                            unit="kcal"
                            color={ACTIVE_COLOR}
                        />
                        <Tile
                            label="최고 활동일"
                            value={Math.round(rangeStats.best.active).toLocaleString()}
                            unit="kcal"
                            sub={bestDate ? `${bestDate.getMonth() + 1}/${bestDate.getDate()} (${DAY_NAMES[bestDate.getDay()]})` : ''}
                        />
                        <Tile
                            label="기록 커버리지"
                            value={Math.min(Math.round((rangeStats.recorded / rangeStats.totalDays) * 100), 100)}
                            unit="%"
                            sub={`${rangeStats.recorded}/${rangeStats.totalDays}일`}
                        />
                    </div>
                )}

                {rangeStats && rangeStats.recorded === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '1.25rem' }}>
                        선택한 기간에 소모 칼로리 기록이 없습니다.
                    </p>
                ) : (
                    <EnergyChart buckets={buckets} metric={metric} showMA={unit === 'day'} />
                )}
            </div>

            {/* 인사이트 */}
            {rangeStats && rangeStats.recorded > 0 && (
                <div className="apple-card">
                    <div className="apple-card-title">
                        <TrendingUp size={18} color={ACTIVE_COLOR} />
                        <span>활동 인사이트</span>
                    </div>
                    <div className="insights-list" style={{ marginTop: '1.25rem' }}>
                        {rangeStats.bestDow !== -1 && (
                            <div className="insight-item">
                                <div className="insight-icon"><Trophy size={16} color="#F2C94C" /></div>
                                <p style={{ margin: 0 }}>
                                    이 기간 가장 활동적인 요일은 평균 <strong style={{ fontWeight: 600 }}>{Math.round(rangeStats.bestDowAvg).toLocaleString()} kcal</strong>를 태운 <strong style={{ fontWeight: 600 }}>{DAY_NAMES[rangeStats.bestDow]}요일</strong>입니다.
                                </p>
                            </div>
                        )}
                        {rangeStats.trendPct != null && Math.abs(rangeStats.trendPct) >= 1 && (
                            <div className="insight-item">
                                <div className="insight-icon">
                                    {rangeStats.trendPct >= 0
                                        ? <TrendingUp size={16} color="#27AE60" />
                                        : <TrendingDown size={16} color="#EB5757" />}
                                </div>
                                <p style={{ margin: 0 }}>
                                    기간 후반부의 일평균 총 소모가 전반부 대비 약 <strong style={{ fontWeight: 600 }}>{Math.abs(Math.round(rangeStats.trendPct))}% {rangeStats.trendPct >= 0 ? '증가' : '감소'}</strong>했습니다.
                                </p>
                            </div>
                        )}
                        <div className="insight-item">
                            <div className="insight-icon"><Sigma size={16} color="#2D9CDB" /></div>
                            <p style={{ margin: 0 }}>
                                이 기간 누적 활동 칼로리는 <strong style={{ fontWeight: 600 }}>{Math.round(rangeStats.sumActive).toLocaleString()} kcal</strong>입니다. 체지방 약 <strong style={{ fontWeight: 600 }}>{(rangeStats.sumActive / 7700).toFixed(1)}kg</strong>을 태울 수 있는 운동량이에요.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnergyDashboard;
