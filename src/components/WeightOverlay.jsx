import React from 'react';
import { formatWeight } from '../utils/nutrition';
import { WEIGHT_LINE_COLOR, computeWeightScale, buildWeightSeries } from '../utils/weightChart';

/**
 * 기존 SVG 차트 위에 아침 공복 체중 꺾은선(+ 선택적 우측 kg 축)을 그리는 공용 오버레이.
 */
const WeightOverlay = ({
    buckets,
    getWeight = (b) => b.avgWeight,
    xFor,
    padTop,
    plotH,
    rightAxisX,
    showRightAxis = true,
    showDots = true,
    hoveredIndex = null,
    color = WEIGHT_LINE_COLOR,
}) => {
    const rawValues = buckets
        .map(getWeight)
        .filter((v) => v != null && Number.isFinite(v));
    const scale = computeWeightScale(rawValues);
    if (!scale) return null;

    const yFor = (v) => padTop + plotH - ((v - scale.yMin) / scale.ySpan) * plotH;
    const { validPoints, solidSegments, gapSegments } = buildWeightSeries(buckets, getWeight, xFor, yFor);

    return (
        <g style={{ pointerEvents: 'none' }}>
            {showRightAxis && rightAxisX != null && [0, 0.5, 1].map((ratio, i) => {
                const val = scale.yMin + scale.ySpan * ratio;
                const y = padTop + (1 - ratio) * plotH;
                return (
                    <text
                        key={i}
                        x={rightAxisX}
                        y={y + 3}
                        fill={color}
                        opacity="0.8"
                        fontSize="8"
                        textAnchor="start"
                    >
                        {formatWeight(val)}kg
                    </text>
                );
            })}

            {gapSegments.map((s, idx) => (
                <line
                    key={`w-gap-${idx}`}
                    x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke={color}
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                    opacity="0.5"
                />
            ))}

            {solidSegments.map((s, idx) => (
                <line
                    key={`w-solid-${idx}`}
                    x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            ))}

            {validPoints.map((p) => {
                const isHovered = hoveredIndex === p.idx;
                if (!showDots && !isHovered && validPoints.length > 1) return null;
                return (
                    <circle
                        key={`w-pt-${p.idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 3.6 : 2.3}
                        fill={color}
                        stroke="var(--bg-secondary, #1E1E1E)"
                        strokeWidth="1.1"
                    />
                );
            })}
        </g>
    );
};

export default WeightOverlay;
