export const WEIGHT_LINE_COLOR = '#2DD4BF';

export function computeWeightScale(values) {
    if (!values || values.length === 0) return null;
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const mid = (rawMin + rawMax) / 2;
    const halfSpan = Math.max(((rawMax - rawMin) / 2) * 1.25, 0.8);
    const yMin = Math.floor((mid - halfSpan) * 2) / 2;
    const yMax = Math.ceil((mid + halfSpan) * 2) / 2;
    return { yMin, yMax, ySpan: Math.max(yMax - yMin, 1) };
}

/**
 * 버킷 배열에서 체중 점, 연속 실선, 결측 구간 점선을 계산한다.
 */
export function buildWeightSeries(buckets, getWeight, xFor, yFor) {
    const validPoints = [];
    buckets.forEach((b, idx) => {
        const w = getWeight(b);
        if (w != null && Number.isFinite(w)) {
            validPoints.push({ idx, val: w, x: xFor(idx), y: yFor(w) });
        }
    });

    const solidSegments = [];
    const gapSegments = [];
    for (let i = 1; i < validPoints.length; i++) {
        const prev = validPoints[i - 1];
        const curr = validPoints[i];
        const seg = { x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y };
        if (curr.idx - prev.idx === 1) solidSegments.push(seg);
        else gapSegments.push(seg);
    }

    return { validPoints, solidSegments, gapSegments };
}
