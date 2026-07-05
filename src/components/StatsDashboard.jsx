import React, { useState, useMemo } from 'react';
import { Flame, Target, TrendingUp, Sparkles, Trophy, ChevronRight, Apple } from 'lucide-react';
import { getEffectiveCalories } from '../utils/nutrition';

// Custom SVG Bar Chart Component
const BarChart = ({ data, activeUnit = 'kcal' }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });

    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    const maxVal = Math.max(...values, 1000); // Prevent division by zero and scale nicely

    const height = 160;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 25;

    return (
        <div style={{ position: 'relative', width: '100%', marginTop: '1.5rem' }}>
            <svg viewBox={`0 0 500 ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = paddingTop + (1 - ratio) * (height - paddingTop - paddingBottom);
                    const val = Math.round(maxVal * ratio);
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
                            <text 
                                x={paddingLeft - 8} 
                                y={y + 3} 
                                fill="var(--text-tertiary)" 
                                fontSize="9" 
                                textAnchor="end"
                            >
                                {val}
                            </text>
                        </g>
                    );
                })}

                {/* Bars */}
                {data.map((item, idx) => {
                    const barCount = data.length;
                    const chartWidth = 500 - paddingLeft - paddingRight;
                    const colWidth = chartWidth / barCount;
                    const barWidth = Math.min(colWidth * 0.5, 24); // Limit max bar width
                    
                    const x = paddingLeft + idx * colWidth + (colWidth - barWidth) / 2;
                    
                    const barHeight = (item.value / maxVal) * (height - paddingTop - paddingBottom);
                    const y = height - paddingBottom - barHeight;

                    const isHovered = hoveredIndex === idx;

                    return (
                        <g key={idx}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, 2)}
                                rx="4"
                                fill={isHovered ? 'var(--accent-primary)' : 'rgba(235, 87, 87, 0.6)'}
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
                            {/* X Axis Labels */}
                            <text
                                x={x + barWidth / 2}
                                y={height - 8}
                                fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                                fontSize="10"
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
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    padding: '0.4rem 0.6rem',
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
                    alignItems: 'center',
                    gap: '2px'
                }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                        {data[hoveredIndex].periodLabel || data[hoveredIndex].label}
                    </span>
                    <span style={{ color: 'var(--accent-primary)' }}>
                        {Math.round(data[hoveredIndex].value).toLocaleString()} {activeUnit}
                    </span>
                    {data[hoveredIndex].loggedDays !== undefined && (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
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

const StatsDashboard = ({ meals }) => {
    const [viewType, setViewType] = useState('week'); // 'week' | 'month' | 'year'
    const [targetCalorie, setTargetCalorie] = useState(() => {
        const saved = localStorage.getItem('mealog_target_calorie');
        return saved ? Number(saved) : 2000;
    });

    const handleTargetCalorieChange = (e) => {
        const val = Number(e.target.value) || 2000;
        setTargetCalorie(val);
        localStorage.setItem('mealog_target_calorie', val);
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

    // 2. Generate stats based on viewType (week, month, year)
    const reportData = useMemo(() => {
        if (meals.length === 0) return { chartData: [], summary: {} };

        const today = new Date();

        if (viewType === 'week') {
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
    }, [meals, viewType, dailyData]);

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

    return (
        <div className="stats-dashboard">
            <div className="stats-header">
                <h1 className="stats-title">요약</h1>
                
                {/* Segmented Controls */}
                <div className="segmented-control">
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
                            <div className="apple-card-title">
                                <Target size={18} color="var(--accent-secondary)" />
                                <span>평균 탄단지 비율 ({summary.periodName})</span>
                            </div>

                            <div style={{ marginTop: '1.25rem' }}>
                                {/* Horizontal Stacked Bar */}
                                <div style={{
                                    display: 'flex',
                                    height: '24px',
                                    borderRadius: '6px',
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

                                {/* Macro Details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-tertiary)' }} />
                                            <span style={{ fontSize: '0.875rem' }}>탄수화물</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                            {Math.round(summary.avgCarbs)}g 
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                                                ({Math.round(carbPercent)}%)
                                            </span>
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-quaternary)' }} />
                                            <span style={{ fontSize: '0.875rem' }}>단백질</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                            {Math.round(summary.avgProtein)}g 
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                                                ({Math.round(proteinPercent)}%)
                                            </span>
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-secondary)' }} />
                                            <span style={{ fontSize: '0.875rem' }}>지방</span>
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                            {Math.round(summary.avgFat)}g 
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                                                ({Math.round(fatPercent)}%)
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Chart Card */}
                    <div className="apple-card" style={{ marginBottom: '2rem' }}>
                        <div className="apple-card-title">
                            <TrendingUp size={18} color="var(--accent-primary)" />
                            <span>칼로리 추세 리포트</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>
                            {viewType === 'week' ? '최근 8주간의 주차별 일평균 섭취량' : 
                             viewType === 'month' ? '최근 6개월간의 월별 일평균 섭취량' : 
                             '연도별 일평균 섭취량'}
                        </p>
                        <BarChart data={chartData} />
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
