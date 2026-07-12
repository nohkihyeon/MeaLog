import React, { useState, useMemo } from 'react';
import { Flame, Target, TrendingUp, Sparkles, Trophy, ChevronRight, Apple, Settings } from 'lucide-react';
import { getEffectiveCalories } from '../utils/nutrition';
import CalorieBalanceCard from './CalorieBalanceCard';

// Custom SVG Bar Chart Component supporting multi-metric overlay
const BarChart = ({ data, visibleMetrics }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });

    if (!data || data.length === 0) return null;

    // 좌측 축(kcal): 섭취 막대 + 소모/활동 라인이 함께 쓴다
    const values = data.flatMap(d => [
        visibleMetrics.calorie ? d.value : 0,
        visibleMetrics.burn && d.burn != null ? d.burn : 0,
        visibleMetrics.active && d.active != null ? d.active : 0,
    ]);
    const maxVal = Math.max(...values, 1000); // Prevent division by zero and scale nicely
    const showKcalAxis = visibleMetrics.calorie || visibleMetrics.burn || visibleMetrics.active;

    // Compute max macro value for right-hand Y axis scaling
    const macroValues = data.flatMap(d => [
        visibleMetrics.carbs ? d.avgCarbs : 0,
        visibleMetrics.protein ? d.avgProtein : 0,
        visibleMetrics.fat ? d.avgFat : 0
    ]);
    const maxMacro = Math.max(...macroValues, 100);

    const height = 160;
    const paddingLeft = 35;
    const paddingRight = 35; // Add space for right Y-axis
    const paddingTop = 20;
    const paddingBottom = 25;

    const chartWidth = 500 - paddingLeft - paddingRight;
    const barCount = data.length;
    const colWidth = chartWidth / barCount;

    // Helper to get X coordinate of a column center
    const getColCenterX = (idx) => {
        return paddingLeft + idx * colWidth + colWidth / 2;
    };

    // Helper to get Y coordinate for a macro value (right axis)
    const getMacroY = (val) => {
        const h = (val / maxMacro) * (height - paddingTop - paddingBottom);
        return height - paddingBottom - h;
    };

    // Construct path for a macro line
    const getLinePath = (key) => {
        const points = data.map((d, idx) => {
            const val = key === 'carbs' ? d.avgCarbs : key === 'protein' ? d.avgProtein : d.avgFat;
            return `${getColCenterX(idx)},${getMacroY(val)}`;
        });
        return `M ${points.join(' L ')}`;
    };

    // 좌측 kcal 축용 Y 좌표 (소모/활동 라인)
    const getKcalY = (val) => {
        const h = (val / maxVal) * (height - paddingTop - paddingBottom);
        return height - paddingBottom - h;
    };

    // 소모/활동 라인 path — 데이터 없는 구간(null)은 선을 끊는다
    const getKcalLinePath = (key) => {
        let path = '';
        let pen = false;
        data.forEach((d, idx) => {
            const val = d[key];
            if (val == null) { pen = false; return; }
            const pt = `${getColCenterX(idx)},${getKcalY(val)}`;
            path += pen ? ` L ${pt}` : ` M ${pt}`;
            pen = true;
        });
        return path;
    };

    const BURN_COLOR = '#9B51E0';
    const ACTIVE_COLOR = '#F2994A';

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '1.5rem' }}>
            <svg viewBox={`0 0 500 ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = paddingTop + (1 - ratio) * (height - paddingTop - paddingBottom);
                    const val = Math.round(maxVal * ratio);
                    const rightVal = Math.round(maxMacro * ratio);
                    return (
                        <g key={idx}>
                            <line 
                                x1={paddingLeft} 
                                y1={y} 
                                x2={500 - paddingRight} 
                                y2={y} 
                                stroke="var(--border-color)" 
                                strokeWidth="1" 
                                strokeDasharray="4 4" 
                            />
                            {/* Left Y Axis (kcal) */}
                            {showKcalAxis && (
                                <text 
                                    x={paddingLeft - 8} 
                                    y={y + 3} 
                                    fill="var(--text-tertiary)" 
                                    fontSize="8" 
                                    textAnchor="end"
                                >
                                    {val}
                                </text>
                            )}
                            {/* Right Y Axis (Macros) */}
                            {(visibleMetrics.carbs || visibleMetrics.protein || visibleMetrics.fat) && (
                                <text 
                                    x={500 - paddingRight + 8} 
                                    y={y + 3} 
                                    fill="var(--text-tertiary)" 
                                    fontSize="8" 
                                    textAnchor="start"
                                >
                                    {rightVal}g
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Bars (Calories) */}
                {visibleMetrics.calorie && data.map((item, idx) => {
                    const barWidth = Math.min(colWidth * 0.45, 18);
                    const x = paddingLeft + idx * colWidth + (colWidth - barWidth) / 2;
                    const barHeight = (item.value / maxVal) * (height - paddingTop - paddingBottom);
                    const y = height - paddingBottom - barHeight;
                    const isHovered = hoveredIndex === idx;

                    return (
                        <rect
                            key={idx}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(barHeight, 2)}
                            rx="3"
                            fill={isHovered ? 'var(--accent-primary)' : 'rgba(235, 87, 87, 0.35)'}
                            style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                            onMouseEnter={(e) => {
                                setHoveredIndex(idx);
                                setHoveredPos({
                                    x: x + barWidth / 2,
                                    y: y - 10
                                });
                            }}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                    );
                })}

                {/* Burn / Active Lines (좌측 kcal 축) */}
                {visibleMetrics.burn && (
                    <path
                        d={getKcalLinePath('burn')}
                        fill="none"
                        stroke={BURN_COLOR}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {visibleMetrics.active && (
                    <path
                        d={getKcalLinePath('active')}
                        fill="none"
                        stroke={ACTIVE_COLOR}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Macro Lines */}
                {visibleMetrics.carbs && (
                    <path
                        d={getLinePath('carbs')}
                        fill="none"
                        stroke="var(--accent-tertiary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {visibleMetrics.protein && (
                    <path
                        d={getLinePath('protein')}
                        fill="none"
                        stroke="var(--accent-quaternary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {visibleMetrics.fat && (
                    <path
                        d={getLinePath('fat')}
                        fill="none"
                        stroke="var(--accent-secondary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Markers & Interaction Triggers */}
                {data.map((item, idx) => {
                    const cx = getColCenterX(idx);
                    const isHovered = hoveredIndex === idx;

                    return (
                        <g key={idx}>
                            {visibleMetrics.burn && item.burn != null && (
                                <circle cx={cx} cy={getKcalY(item.burn)} r={isHovered ? 4 : 2} fill={BURN_COLOR} />
                            )}
                            {visibleMetrics.active && item.active != null && (
                                <circle cx={cx} cy={getKcalY(item.active)} r={isHovered ? 4 : 2} fill={ACTIVE_COLOR} />
                            )}
                            {visibleMetrics.carbs && (
                                <circle cx={cx} cy={getMacroY(item.avgCarbs)} r={isHovered ? 4 : 2} fill="var(--accent-tertiary)" />
                            )}
                            {visibleMetrics.protein && (
                                <circle cx={cx} cy={getMacroY(item.avgProtein)} r={isHovered ? 4 : 2} fill="var(--accent-quaternary)" />
                            )}
                            {visibleMetrics.fat && (
                                <circle cx={cx} cy={getMacroY(item.avgFat)} r={isHovered ? 4 : 2} fill="var(--accent-secondary)" />
                            )}

                            {/* Invisible full-height bar for hover triggers */}
                            <rect
                                x={paddingLeft + idx * colWidth}
                                y={paddingTop}
                                width={colWidth}
                                height={height - paddingTop - paddingBottom}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(e) => {
                                    setHoveredIndex(idx);
                                    setHoveredPos({
                                        x: cx,
                                        y: paddingTop + 10
                                    });
                                }}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />

                            {/* X Axis Labels */}
                            <text
                                x={cx}
                                y={height - 8}
                                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                                fontSize="9"
                                fontWeight={isHovered ? '600' : '400'}
                                textAnchor="middle"
                                style={{ transition: 'all 0.2s ease' }}
                            >
                                {item.label}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredIndex !== null && (
                <div style={{
                    position: 'absolute',
                    left: `${(hoveredPos.x / 500) * 100}%`,
                    top: `${(hoveredPos.y / height) * 100}%`,
                    transform: 'translate(-50%, -105%)',
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
                        {data[hoveredIndex].periodLabel || data[hoveredIndex].label}
                    </span>
                    {visibleMetrics.calorie && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🔥 칼로리</span>
                            <span style={{ color: 'var(--accent-primary)' }}>
                                {Math.round(data[hoveredIndex].value).toLocaleString()} kcal
                            </span>
                        </div>
                    )}
                    {visibleMetrics.burn && data[hoveredIndex].burn != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>⚡ 소모</span>
                            <span style={{ color: '#9B51E0' }}>
                                {Math.round(data[hoveredIndex].burn).toLocaleString()} kcal
                            </span>
                        </div>
                    )}
                    {visibleMetrics.active && data[hoveredIndex].active != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🏃 활동</span>
                            <span style={{ color: '#F2994A' }}>
                                {Math.round(data[hoveredIndex].active).toLocaleString()} kcal
                            </span>
                        </div>
                    )}
                    {visibleMetrics.carbs && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>🌾 탄수화물</span>
                            <span style={{ color: 'var(--accent-tertiary)' }}>
                                {Math.round(data[hoveredIndex].avgCarbs)}g
                            </span>
                        </div>
                    )}
                    {visibleMetrics.protein && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>💪 단백질</span>
                            <span style={{ color: 'var(--accent-quaternary)' }}>
                                {Math.round(data[hoveredIndex].avgProtein)}g
                            </span>
                        </div>
                    )}
                    {visibleMetrics.fat && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>💧 지방</span>
                            <span style={{ color: 'var(--accent-secondary)' }}>
                                {Math.round(data[hoveredIndex].avgFat)}g
                            </span>
                        </div>
                    )}
                    {data[hoveredIndex].loggedDays !== undefined && (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem', alignSelf: 'center', marginTop: '2px' }}>
                            기록일: {data[hoveredIndex].loggedDays}일
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

// Activity Ring SVG Component
const ActivityRing = ({ percentage, size = 100, strokeWidth = 10 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} className="ring-svg">
                <circle
                    className="ring-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <circle
                    className="ring-progress"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                />
            </svg>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column'
            }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {Math.round(percentage)}%
                </span>
            </div>
        </div>
    );
};

const StatsDashboard = ({ meals, dailyEnergy = [] }) => {
    const [viewType, setViewType] = useState('week'); // 'day' | 'week' | 'month' | 'year'
    const [targetCalorie, setTargetCalorie] = useState(() => {
        const saved = localStorage.getItem('mealog_target_calorie');
        return saved ? Number(saved) : 2000;
    });

    // 수동 기초대사량 (칼로리 밸런스 카드의 설정과 공유)
    const [manualBmr, setManualBmr] = useState(() => {
        const saved = localStorage.getItem('mealog_manual_bmr');
        return saved !== null ? Number(saved) : 1600;
    });

    const [ratioCarbs, setRatioCarbs] = useState(() => {
        const saved = localStorage.getItem('mealog_ratio_carbs');
        return saved ? Number(saved) : 4;
    });
    const [ratioProtein, setRatioProtein] = useState(() => {
        const saved = localStorage.getItem('mealog_ratio_protein');
        return saved ? Number(saved) : 4;
    });
    const [ratioFat, setRatioFat] = useState(() => {
        const saved = localStorage.getItem('mealog_ratio_fat');
        return saved ? Number(saved) : 2;
    });

    const [isEditingMacros, setIsEditingMacros] = useState(false);
    const [editCalorie, setEditCalorie] = useState(targetCalorie);
    const [editCarbs, setEditCarbs] = useState(ratioCarbs);
    const [editProtein, setEditProtein] = useState(ratioProtein);
    const [editFat, setEditFat] = useState(ratioFat);

    const [visibleMetrics, setVisibleMetrics] = useState({
        calorie: true,
        carbs: false,
        protein: false,
        fat: false,
        burn: false,
        active: false
    });

    const handleTargetCalorieChange = (e) => {
        const val = Number(e.target.value) || 2000;
        setTargetCalorie(val);
        setEditCalorie(val);
        localStorage.setItem('mealog_target_calorie', val);
    };

    const handleSaveMacros = () => {
        const cal = Number(editCalorie) || 2000;
        const c = Number(editCarbs) >= 0 ? Number(editCarbs) : 4;
        const p = Number(editProtein) >= 0 ? Number(editProtein) : 4;
        const f = Number(editFat) >= 0 ? Number(editFat) : 2;

        setTargetCalorie(cal);
        setRatioCarbs(c);
        setRatioProtein(p);
        setRatioFat(f);

        localStorage.setItem('mealog_target_calorie', cal);
        localStorage.setItem('mealog_ratio_carbs', c);
        localStorage.setItem('mealog_ratio_protein', p);
        localStorage.setItem('mealog_ratio_fat', f);

        setIsEditingMacros(false);
    };

    const handleCancelMacros = () => {
        setEditCalorie(targetCalorie);
        setEditCarbs(ratioCarbs);
        setEditProtein(ratioProtein);
        setEditFat(ratioFat);
        setIsEditingMacros(false);
    };

    // 1. Group all meals by YYYY-MM-DD
    const dailyData = useMemo(() => {
        const stats = {};
        meals.forEach(meal => {
            if (meal.deleted) return;
            const d = meal.date;
            if (!stats[d]) {
                stats[d] = { calories: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 };
            }
            stats[d].calories += getEffectiveCalories(meal);
            stats[d].protein += (Number(meal.protein) || 0);
            stats[d].carbs += (Number(meal.carbs) || 0);
            stats[d].fat += (Number(meal.fat) || 0);
            stats[d].mealCount += 1;
        });
        return stats;
    }, [meals]);

    // 1.5. 일별 소모/활동 칼로리 맵 (기초값 없으면 수동 BMR 폴백)
    const energyByDate = useMemo(() => {
        const map = {};
        dailyEnergy.forEach(e => {
            const basal = e.basal > 0 ? e.basal : manualBmr;
            map[e.date] = { burn: basal + e.active, active: e.active };
        });
        return map;
    }, [dailyEnergy, manualBmr]);

    // 2. Generate stats based on viewType (day, week, month, year)
    const reportData = useMemo(() => {
        if (meals.length === 0) return { chartData: [], summary: {} };

        const today = new Date();

        if (viewType === 'day') {
            // 최근 14일, 하루 단위
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const chartData = [];
            let sumCal = 0, sumP = 0, sumC = 0, sumF = 0, logged = 0;

            for (let i = 13; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const key = `${yyyy}-${mm}-${dd}`;

                const day = dailyData[key];
                const energy = energyByDate[key];

                if (day) {
                    sumCal += day.calories;
                    sumP += day.protein;
                    sumC += day.carbs;
                    sumF += day.fat;
                    logged += 1;
                }

                chartData.push({
                    label: i === 0 ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`,
                    periodLabel: `${yyyy}.${d.getMonth() + 1}.${d.getDate()} (${dayNames[d.getDay()]})`,
                    value: day ? day.calories : 0,
                    avgProtein: day ? day.protein : 0,
                    avgCarbs: day ? day.carbs : 0,
                    avgFat: day ? day.fat : 0,
                    burn: energy ? energy.burn : null,
                    active: energy ? energy.active : null,
                });
            }

            return {
                chartData,
                summary: {
                    avgCal: logged > 0 ? sumCal / logged : 0,
                    avgProtein: logged > 0 ? sumP / logged : 0,
                    avgCarbs: logged > 0 ? sumC / logged : 0,
                    avgFat: logged > 0 ? sumF / logged : 0,
                    loggedDays: logged,
                    totalDays: 14,
                    periodName: '최근 14일'
                }
            };

        } else if (viewType === 'week') {
            // Helper: Find Monday of a given date
            const getMonday = (d) => {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(date.setDate(diff));
                monday.setHours(0, 0, 0, 0);
                return monday;
            };

            const chartData = [];
            const currentMonday = getMonday(today);

            // Last 8 weeks
            for (let i = 7; i >= 0; i--) {
                const monday = new Date(currentMonday);
                monday.setDate(currentMonday.getDate() - i * 7);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);

                let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, loggedDays = 0;

                let totalBurn = 0, totalActive = 0, energyDays = 0;

                // Scan days in the week
                for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const key = `${yyyy}-${mm}-${dd}`;

                    if (dailyData[key]) {
                        totalCal += dailyData[key].calories;
                        totalP += dailyData[key].protein;
                        totalC += dailyData[key].carbs;
                        totalF += dailyData[key].fat;
                        loggedDays += 1;
                    }
                    if (energyByDate[key]) {
                        totalBurn += energyByDate[key].burn;
                        totalActive += energyByDate[key].active;
                        energyDays += 1;
                    }
                }

                const avgCal = loggedDays > 0 ? totalCal / loggedDays : 0;
                const avgP = loggedDays > 0 ? totalP / loggedDays : 0;
                const avgC = loggedDays > 0 ? totalC / loggedDays : 0;
                const avgF = loggedDays > 0 ? totalF / loggedDays : 0;

                const label = `${monday.getMonth() + 1}/${monday.getDate()}`;
                const periodLabel = `${monday.getFullYear()}.${monday.getMonth() + 1}.${monday.getDate()} ~ ${sunday.getMonth() + 1}.${sunday.getDate()}`;

                chartData.push({
                    label,
                    periodLabel,
                    value: avgCal,
                    avgProtein: avgP,
                    avgCarbs: avgC,
                    avgFat: avgF,
                    burn: energyDays > 0 ? totalBurn / energyDays : null,
                    active: energyDays > 0 ? totalActive / energyDays : null,
                    loggedDays,
                    totalDays: 7
                });
            }

            // Summary represents the current (last) week
            const currentWeek = chartData[chartData.length - 1] || {};

            return {
                chartData,
                summary: {
                    avgCal: currentWeek.value || 0,
                    avgProtein: currentWeek.avgProtein || 0,
                    avgCarbs: currentWeek.avgCarbs || 0,
                    avgFat: currentWeek.avgFat || 0,
                    loggedDays: currentWeek.loggedDays || 0,
                    totalDays: 7,
                    periodName: '이번 주'
                }
            };

        } else if (viewType === 'month') {
            const chartData = [];
            // Last 6 months
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const year = d.getFullYear();
                const month = d.getMonth(); // 0-11
                const numDays = new Date(year, month + 1, 0).getDate();

                let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, loggedDays = 0;

                let totalBurn = 0, totalActive = 0, energyDays = 0;

                for (let dayNum = 1; dayNum <= numDays; dayNum++) {
                    const mm = String(month + 1).padStart(2, '0');
                    const dd = String(dayNum).padStart(2, '0');
                    const key = `${year}-${mm}-${dd}`;

                    if (dailyData[key]) {
                        totalCal += dailyData[key].calories;
                        totalP += dailyData[key].protein;
                        totalC += dailyData[key].carbs;
                        totalF += dailyData[key].fat;
                        loggedDays += 1;
                    }
                    if (energyByDate[key]) {
                        totalBurn += energyByDate[key].burn;
                        totalActive += energyByDate[key].active;
                        energyDays += 1;
                    }
                }

                const avgCal = loggedDays > 0 ? totalCal / loggedDays : 0;
                const avgP = loggedDays > 0 ? totalP / loggedDays : 0;
                const avgC = loggedDays > 0 ? totalC / loggedDays : 0;
                const avgF = loggedDays > 0 ? totalF / loggedDays : 0;

                chartData.push({
                    label: `${month + 1}월`,
                    periodLabel: `${year}년 ${month + 1}월`,
                    value: avgCal,
                    avgProtein: avgP,
                    avgCarbs: avgC,
                    avgFat: avgF,
                    burn: energyDays > 0 ? totalBurn / energyDays : null,
                    active: energyDays > 0 ? totalActive / energyDays : null,
                    loggedDays,
                    totalDays: numDays
                });
            }

            const currentMonth = chartData[chartData.length - 1] || {};

            return {
                chartData,
                summary: {
                    avgCal: currentMonth.value || 0,
                    avgProtein: currentMonth.avgProtein || 0,
                    avgCarbs: currentMonth.avgCarbs || 0,
                    avgFat: currentMonth.avgFat || 0,
                    loggedDays: currentMonth.loggedDays || 0,
                    totalDays: currentMonth.totalDays || 30,
                    periodName: '이번 달'
                }
            };

        } else {
            // viewType === 'year'
            // Get unique years from keys of dailyData, fallback to last 3 years if empty
            const yearsMap = {};
            Object.keys(dailyData).forEach(key => {
                yearsMap[key.slice(0, 4)] = true;
            });
            let uniqueYears = Object.keys(yearsMap).sort();
            if (uniqueYears.length === 0) {
                uniqueYears.push(String(today.getFullYear()));
            }
            if (uniqueYears.length === 1) {
                const y = Number(uniqueYears[0]);
                uniqueYears.unshift(String(y - 1));
                uniqueYears.unshift(String(y - 2));
            }

            const chartData = uniqueYears.map(yStr => {
                const yearNum = Number(yStr);
                
                let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, loggedDays = 0;

                Object.keys(dailyData).forEach(key => {
                    if (key.startsWith(yStr)) {
                        totalCal += dailyData[key].calories;
                        totalP += dailyData[key].protein;
                        totalC += dailyData[key].carbs;
                        totalF += dailyData[key].fat;
                        loggedDays += 1;
                    }
                });

                let totalBurn = 0, totalActive = 0, energyDays = 0;
                Object.keys(energyByDate).forEach(key => {
                    if (key.startsWith(yStr)) {
                        totalBurn += energyByDate[key].burn;
                        totalActive += energyByDate[key].active;
                        energyDays += 1;
                    }
                });

                const avgCal = loggedDays > 0 ? totalCal / loggedDays : 0;
                const avgP = loggedDays > 0 ? totalP / loggedDays : 0;
                const avgC = loggedDays > 0 ? totalC / loggedDays : 0;
                const avgF = loggedDays > 0 ? totalF / loggedDays : 0;

                return {
                    label: `${yStr}년`,
                    periodLabel: `${yStr}년`,
                    value: avgCal,
                    avgProtein: avgP,
                    avgCarbs: avgC,
                    avgFat: avgF,
                    burn: energyDays > 0 ? totalBurn / energyDays : null,
                    active: energyDays > 0 ? totalActive / energyDays : null,
                    loggedDays,
                    totalDays: 365
                };
            });

            const currentYear = chartData[chartData.length - 1] || {};

            return {
                chartData,
                summary: {
                    avgCal: currentYear.value || 0,
                    avgProtein: currentYear.avgProtein || 0,
                    avgCarbs: currentYear.avgCarbs || 0,
                    avgFat: currentYear.avgFat || 0,
                    loggedDays: currentYear.loggedDays || 0,
                    totalDays: 365,
                    periodName: '올해'
                }
            };
        }
    }, [meals, viewType, dailyData, energyByDate]);

    // Calculate additional insights
    const insights = useMemo(() => {
        const list = [];
        if (meals.length === 0) return list;

        // 1. Most active day of the week
        const dayOfWeekSum = Array(7).fill(0).map(() => ({ cal: 0, count: 0 }));
        Object.entries(dailyData).forEach(([dateStr, data]) => {
            const dayIdx = new Date(dateStr).getDay(); // 0(Sun) - 6(Sat)
            dayOfWeekSum[dayIdx].cal += data.calories;
            dayOfWeekSum[dayIdx].count += 1;
        });

        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        let maxAvgDayIdx = -1;
        let maxAvgDayCal = 0;

        dayOfWeekSum.forEach((day, idx) => {
            if (day.count > 0) {
                const avg = day.cal / day.count;
                if (avg > maxAvgDayCal) {
                    maxAvgDayCal = avg;
                    maxAvgDayIdx = idx;
                }
            }
        });

        if (maxAvgDayIdx !== -1 && maxAvgDayCal > 0) {
            list.push({
                type: 'trophy',
                icon: Trophy,
                iconColor: '#F2C94C',
                text: `가장 풍족하게 먹은 요일은 평균 ${Math.round(maxAvgDayCal).toLocaleString()} kcal를 기록한 [${dayNames[maxAvgDayIdx]}]입니다.`
            });
        }

        // 2. Meal type analysis
        const typeCount = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
        meals.forEach(m => {
            if (m.deleted) return;
            const t = m.type || 'snack';
            if (typeCount[t] !== undefined) {
                typeCount[t] += 1;
            }
        });

        const sortedTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
        const typeKo = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' };
        if (sortedTypes[0] && sortedTypes[0][1] > 0) {
            list.push({
                type: 'sparkles',
                icon: Sparkles,
                iconColor: '#2D9CDB',
                text: `기록한 식사 중 [${typeKo[sortedTypes[0][0]]}] 식단 비율이 가장 높습니다. (${sortedTypes[0][1]}회 기록)`
            });
        }

        // 3. Comparison with previous period
        if (reportData.chartData.length >= 2) {
            const current = reportData.chartData[reportData.chartData.length - 1].value;
            const previous = reportData.chartData[reportData.chartData.length - 2].value;

            if (current > 0 && previous > 0) {
                const diff = current - previous;
                const pct = Math.abs((diff / previous) * 100);
                const isIncrease = diff > 0;
                list.push({
                    type: 'trending',
                    icon: TrendingUp,
                    iconColor: isIncrease ? '#EB5757' : '#27AE60',
                    text: `${reportData.summary.periodName} 일평균 칼로리 섭취량은 직전 기간 대비 약 [${Math.round(pct)}%] ${isIncrease ? '증가' : '감소'}했습니다.`
                });
            }
        }

        // Add a general check
        const totalLogs = Object.keys(dailyData).length;
        list.push({
            type: 'apple',
            icon: Apple,
            iconColor: '#27AE60',
            text: `지금까지 총 [${totalLogs}일] 동안의 식단을 성실하게 기록하셨습니다. 꾸준한 로그는 건강관리의 첫걸음입니다!`
        });

        return list;
    }, [meals, dailyData, reportData]);

    const { summary, chartData } = reportData;
    const hasMeals = meals.length > 0;

    // Macro sums for percent calculations
    const macroTotal = (summary.avgCarbs || 0) + (summary.avgProtein || 0) + (summary.avgFat || 0) || 1;
    const carbPercent = ((summary.avgCarbs || 0) / macroTotal) * 100;
    const proteinPercent = ((summary.avgProtein || 0) / macroTotal) * 100;
    const fatPercent = ((summary.avgFat || 0) / macroTotal) * 100;

    const caloriePercentage = targetCalorie > 0 ? (summary.avgCal / targetCalorie) * 100 : 0;

    // Dynamic target macronutrient calculations (based on targetCalorie and custom ratios)
    const ratioSum = ratioCarbs + ratioProtein + ratioFat || 10;
    const targetCarbs = (targetCalorie * (ratioCarbs / ratioSum)) / 4;
    const targetProtein = (targetCalorie * (ratioProtein / ratioSum)) / 4;
    const targetFat = (targetCalorie * (ratioFat / ratioSum)) / 9;

    const carbsRatio = targetCarbs > 0 ? ((summary.avgCarbs || 0) / targetCarbs) * 100 : 0;
    const proteinRatio = targetProtein > 0 ? ((summary.avgProtein || 0) / targetProtein) * 100 : 0;
    const fatRatio = targetFat > 0 ? ((summary.avgFat || 0) / targetFat) * 100 : 0;

    const getMacroStatus = (ratio) => {
        if (ratio < 80) return { label: '부족', color: '#F2C94C', bg: 'rgba(242, 201, 76, 0.1)' };
        if (ratio > 120) return { label: '초과', color: '#EB5757', bg: 'rgba(235, 87, 87, 0.1)' };
        return { label: '적정', color: '#27AE60', bg: 'rgba(39, 174, 96, 0.1)' };
    };

    const carbStatus = getMacroStatus(carbsRatio);
    const proteinStatus = getMacroStatus(proteinRatio);
    const fatStatus = getMacroStatus(fatRatio);

    return (
        <div className="stats-dashboard">
            <div className="stats-header">
                <h1 className="stats-title">요약</h1>
                
                {/* Segmented Controls */}
                <div className="segmented-control">
                    <button
                        className={`segmented-button ${viewType === 'day' ? 'active' : ''}`}
                        onClick={() => setViewType('day')}
                    >
                        일간
                    </button>
                    <button
                        className={`segmented-button ${viewType === 'week' ? 'active' : ''}`}
                        onClick={() => setViewType('week')}
                    >
                        주간
                    </button>
                    <button 
                        className={`segmented-button ${viewType === 'month' ? 'active' : ''}`}
                        onClick={() => setViewType('month')}
                    >
                        월간
                    </button>
                    <button 
                        className={`segmented-button ${viewType === 'year' ? 'active' : ''}`}
                        onClick={() => setViewType('year')}
                    >
                        연간
                    </button>
                </div>
            </div>

            {!hasMeals ? (
                <div style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '20px',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍎</div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>데이터가 부족합니다</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
                        칼로리 리포트를 작성하려면 식단 피드에서 음식을 추가해주세요.
                    </p>
                </div>
            ) : (
                <>
                    {/* Apple Dash Grid */}
                    <div className="apple-grid">
                        
                        {/* Summary / Calorie Card */}
                        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div className="apple-card-title">
                                    <Flame size={18} color="var(--accent-primary)" />
                                    <span>일평균 칼로리 ({summary.periodName})</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {Math.round(summary.avgCal).toLocaleString()}
                                            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '4px' }}>
                                                kcal
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                                            {summary.totalDays}일 중 {summary.loggedDays}일 기록됨
                                        </p>
                                    </div>
                                    <ActivityRing percentage={caloriePercentage} size={90} />
                                </div>
                            </div>

                            {/* Target Calorie Customization Slider */}
                            <div style={{
                                marginTop: '1.5rem',
                                paddingTop: '1.25rem',
                                borderTop: '1px solid var(--border-color)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Target size={13} /> 일일 목표 칼로리
                                    </span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{targetCalorie.toLocaleString()} kcal</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1200" 
                                    max="3500" 
                                    step="50"
                                    value={targetCalorie}
                                    onChange={handleTargetCalorieChange}
                                    style={{
                                        width: '100%',
                                        accentColor: 'var(--accent-primary)',
                                        cursor: 'pointer',
                                        height: '4px',
                                        background: 'var(--border-color)',
                                        borderRadius: '2px'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Macronutrients Card */}
                        <div className="apple-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div className="apple-card-title" style={{ margin: 0 }}>
                                    <Target size={18} color="var(--accent-secondary)" />
                                    <span>평균 탄단지 비율 및 달성도 ({ratioCarbs}:{ratioProtein}:{ratioFat})</span>
                                </div>
                                {!isEditingMacros && (
                                    <Settings 
                                        size={16} 
                                        color="var(--text-secondary)"
                                        style={{ cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s' }} 
                                        onClick={() => {
                                            setEditCalorie(targetCalorie);
                                            setEditCarbs(ratioCarbs);
                                            setEditProtein(ratioProtein);
                                            setEditFat(ratioFat);
                                            setIsEditingMacros(true);
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                                    />
                                )}
                            </div>

                            {isEditingMacros ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>목표 칼로리 (kcal)</label>
                                        <input 
                                            type="number"
                                            inputMode="decimal"
                                            value={editCalorie} 
                                            onChange={e => setEditCalorie(Number(e.target.value) || '')}
                                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>탄수화물 비율</label>
                                            <input 
                                                type="number"
                                            inputMode="decimal"
                                                value={editCarbs} 
                                                onChange={e => setEditCarbs(Number(e.target.value) || '')}
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>단백질 비율</label>
                                            <input 
                                                type="number"
                                            inputMode="decimal"
                                                value={editProtein} 
                                                onChange={e => setEditProtein(Number(e.target.value) || '')}
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>지방 비율</label>
                                            <input 
                                                type="number"
                                            inputMode="decimal"
                                                value={editFat} 
                                                onChange={e => setEditFat(Number(e.target.value) || '')}
                                                style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Live Percentage Display */}
                                    {(() => {
                                        const sum = (Number(editCarbs) || 0) + (Number(editProtein) || 0) + (Number(editFat) || 0) || 1;
                                        const cPct = Math.round(((Number(editCarbs) || 0) / sum) * 100);
                                        const pPct = Math.round(((Number(editProtein) || 0) / sum) * 100);
                                        const fPct = Math.round(((Number(editFat) || 0) / sum) * 100);
                                        return (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px', textAlign: 'center' }}>
                                                실제 분배 비율: 탄수화물 {cPct}% | 단백질 {pPct}% | 지방 {fPct}%
                                            </div>
                                        );
                                    })()}

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                                        <button 
                                            onClick={handleSaveMacros}
                                            style={{
                                                flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem',
                                                fontWeight: 600, backgroundColor: 'var(--accent-primary)', color: '#fff',
                                                border: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            저장
                                        </button>
                                        <button 
                                            onClick={handleCancelMacros}
                                            style={{
                                                flex: 1, padding: '0.45rem', borderRadius: '6px', fontSize: '0.8rem',
                                                fontWeight: 600, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                                color: 'var(--text-primary)', cursor: 'pointer'
                                            }}
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                                        <span>실제 {Math.round(carbPercent/10)} : {Math.round(proteinPercent/10)} : {Math.round(fatPercent/10)}</span>
                                        <span style={{ color: 'var(--text-tertiary)' }}>(목표 비율 {ratioCarbs} : {ratioProtein} : {ratioFat})</span>
                                    </div>

                                    <div style={{ marginTop: '0.5rem' }}>
                                        {/* Horizontal Stacked Bar */}
                                        <div style={{
                                            display: 'flex',
                                            height: '16px',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            marginBottom: '1.5rem'
                                        }}>
                                            <div 
                                                style={{ 
                                                    width: `${carbPercent}%`, 
                                                    backgroundColor: 'var(--accent-tertiary)', 
                                                    transition: 'width 0.3s ease' 
                                                }} 
                                                title={`탄수화물: ${Math.round(carbPercent)}%`}
                                            />
                                            <div 
                                                style={{ 
                                                    width: `${proteinPercent}%`, 
                                                    backgroundColor: 'var(--accent-quaternary)', 
                                                    transition: 'width 0.3s ease' 
                                                }} 
                                                title={`단백질: ${Math.round(proteinPercent)}%`}
                                            />
                                            <div 
                                                style={{ 
                                                    width: `${fatPercent}%`, 
                                                    backgroundColor: 'var(--accent-secondary)', 
                                                    transition: 'width 0.3s ease' 
                                                }} 
                                                title={`지방: ${Math.round(fatPercent)}%`}
                                            />
                                        </div>

                                        {/* Macro Comparison List */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {/* Carbs */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-tertiary)' }} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>탄수화물</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: carbStatus.bg,
                                                            color: carbStatus.color
                                                        }}>
                                                            {carbStatus.label}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <strong style={{ color: 'var(--text-primary)' }}>{Math.round(summary.avgCarbs)}g</strong> / {Math.round(targetCarbs)}g ({Math.round(carbsRatio)}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '0.4rem' }}>
                                                    <div style={{
                                                        width: `${Math.min(carbsRatio, 100)}%`,
                                                        height: '100%',
                                                        backgroundColor: carbStatus.color,
                                                        borderRadius: '3px',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Protein */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-quaternary)' }} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>단백질</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: proteinStatus.bg,
                                                            color: proteinStatus.color
                                                        }}>
                                                            {proteinStatus.label}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <strong style={{ color: 'var(--text-primary)' }}>{Math.round(summary.avgProtein)}g</strong> / {Math.round(targetProtein)}g ({Math.round(proteinRatio)}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '0.4rem' }}>
                                                    <div style={{
                                                        width: `${Math.min(proteinRatio, 100)}%`,
                                                        height: '100%',
                                                        backgroundColor: proteinStatus.color,
                                                        borderRadius: '3px',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                </div>
                                            </div>

                                            {/* Fat */}
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-secondary)' }} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>지방</span>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: fatStatus.bg,
                                                            color: fatStatus.color
                                                        }}>
                                                            {fatStatus.label}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        <strong style={{ color: 'var(--text-primary)' }}>{Math.round(summary.avgFat)}g</strong> / {Math.round(targetFat)}g ({Math.round(fatRatio)}%)
                                                    </span>
                                                </div>
                                                <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '0.4rem' }}>
                                                    <div style={{
                                                        width: `${Math.min(fatRatio, 100)}%`,
                                                        height: '100%',
                                                        backgroundColor: fatStatus.color,
                                                        borderRadius: '3px',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>

                    {/* Calorie Balance Card (섭취 vs 소모) */}
                    <CalorieBalanceCard
                        dailyData={dailyData}
                        dailyEnergy={dailyEnergy}
                        viewType={viewType}
                        manualBmr={manualBmr}
                        onChangeManualBmr={setManualBmr}
                    />

                    {/* Chart Card */}
                    <div className="apple-card" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <div className="apple-card-title" style={{ marginBottom: '0.25rem' }}>
                                    <TrendingUp size={18} color="var(--accent-primary)" />
                                    <span>칼로리 & 영양소 추세 리포트</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {viewType === 'day' ? '최근 14일간의 일별 섭취량' :
                                     viewType === 'week' ? '최근 8주간의 주차별 일평균 섭취량' :
                                     viewType === 'month' ? '최근 6개월간의 월별 일평균 섭취량' :
                                     '연도별 일평균 섭취량'}
                                </p>
                            </div>
                            
                            {/* Toggle pills */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button 
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, calorie: !prev.calorie }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.calorie ? 'rgba(235, 87, 87, 0.15)' : 'transparent',
                                        color: visibleMetrics.calorie ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    칼로리
                                </button>
                                <button 
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, carbs: !prev.carbs }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.carbs ? 'rgba(242, 201, 76, 0.15)' : 'transparent',
                                        color: visibleMetrics.carbs ? 'var(--accent-tertiary)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    탄수화물
                                </button>
                                <button 
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, protein: !prev.protein }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.protein ? 'rgba(39, 174, 96, 0.15)' : 'transparent',
                                        color: visibleMetrics.protein ? 'var(--accent-quaternary)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    단백질
                                </button>
                                <button 
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, fat: !prev.fat }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.fat ? 'rgba(45, 156, 219, 0.15)' : 'transparent',
                                        color: visibleMetrics.fat ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    지방
                                </button>
                                <button
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, burn: !prev.burn }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.burn ? 'rgba(155, 81, 224, 0.15)' : 'transparent',
                                        color: visibleMetrics.burn ? '#9B51E0' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    소모
                                </button>
                                <button
                                    onClick={() => setVisibleMetrics(prev => ({ ...prev, active: !prev.active }))}
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        backgroundColor: visibleMetrics.active ? 'rgba(242, 153, 74, 0.15)' : 'transparent',
                                        color: visibleMetrics.active ? '#F2994A' : 'var(--text-secondary)',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    활동
                                </button>
                            </div>
                        </div>
                        <BarChart data={chartData} visibleMetrics={visibleMetrics} />
                    </div>

                    {/* Insights Card */}
                    <div className="apple-card">
                        <div className="apple-card-title">
                            <Sparkles size={18} color="#F2C94C" />
                            <span>식습관 인사이트 (Trends & Highlights)</span>
                        </div>

                        <div className="insights-list" style={{ marginTop: '1.25rem' }}>
                            {insights.map((insight, idx) => {
                                const Icon = insight.icon;
                                return (
                                    <div key={idx} className="insight-item">
                                        <div className="insight-icon">
                                            <Icon size={16} color={insight.iconColor} />
                                        </div>
                                        <p style={{ margin: 0 }}>
                                            {insight.text.split(/\[(.*?)\]/g).map((part, i) => 
                                                i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong> : part
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StatsDashboard;
