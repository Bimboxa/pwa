// utils/getBestSnap.js

// --- GEOMETRY HELPERS ---

const dist2 = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
};

// Project point P onto line segment AB. Returns { x, y, d2 }
const projectOnSegment = (px, py, ax, ay, bx, by, forceCenter) => {
    const lux = bx - ax;
    const luy = by - ay;
    const len2 = lux * lux + luy * luy;

    let projX, projY, d2;

    if (len2 === 0) {
        projX = ax;
        projY = ay;
        d2 = dist2({ x: px, y: py }, { x: ax, y: ay });
    } else {
        let t = ((px - ax) * lux + (py - ay) * luy) / len2;
        t = Math.max(0, Math.min(1, t));

        projX = ax + lux * t;
        projY = ay + luy * t;
        const dx = px - projX;
        const dy = py - projY;
        d2 = dx * dx + dy * dy;
    }

    if (forceCenter) {
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;
        return { x: midX, y: midY, d2: d2 };
    }

    return { x: projX, y: projY, d2: d2 };
};

// Calculate circle from 3 points. Returns { center: {x,y}, r, isCW } or null
const getCircleFrom3Points = (p0, p1, p2) => {
    const x1 = p0.x, y1 = p0.y;
    const x2 = p1.x, y2 = p1.y;
    const x3 = p2.x, y3 = p2.y;

    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(D) < 1e-9) return null;

    const x1sq_y1sq = x1 * x1 + y1 * y1;
    const x2sq_y2sq = x2 * x2 + y2 * y2;
    const x3sq_y3sq = x3 * x3 + y3 * y3;

    const ux = (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) / D;
    const uy = (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) / D;

    const center = { x: ux, y: uy };
    const r = Math.hypot(x1 - ux, y1 - uy);
    const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const isCW = cross > 0;

    return { center, r, isCW };
};

const projectOnArc = (px, py, center, r, start, end, isCW, forceCenter) => {
    const TWO_PI = Math.PI * 2;
    const normalize = (a) => {
        let res = a % TWO_PI;
        if (res < 0) res += TWO_PI;
        return res;
    };

    const angleStart = Math.atan2(start.y - center.y, start.x - center.x);
    const angleEnd = Math.atan2(end.y - center.y, end.x - center.x);

    const dx = px - center.x;
    const dy = py - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const projX = dist === 0 ? start.x : center.x + (dx / dist) * r;
    const projY = dist === 0 ? start.y : center.y + (dy / dist) * r;

    const angleAt = Math.atan2(projY - center.y, projX - center.x);
    let relPoint = normalize(angleAt - angleStart);
    let relEndCCW = normalize(angleEnd - angleStart);

    let inArc = false;
    if (isCW) {
        if (relPoint < relEndCCW) inArc = true;
    } else {
        if (relPoint > relEndCCW) inArc = true;
    }

    let bestX, bestY;
    if (inArc) {
        bestX = projX;
        bestY = projY;
    } else {
        const dStart = dist2({ x: px, y: py }, start);
        const dEnd = dist2({ x: px, y: py }, end);
        if (dStart < dEnd) {
            bestX = start.x; bestY = start.y;
        } else {
            bestX = end.x; bestY = end.y;
        }
    }

    const d2 = dist2({ x: px, y: py }, { x: bestX, y: bestY });

    if (forceCenter) {
        let midX, midY;
        if (isCW) {
            let span = (angleEnd - angleStart);
            if (span < 0) span += TWO_PI;
            const midAngle = angleStart + span / 2;
            midX = center.x + Math.cos(midAngle) * r;
            midY = center.y + Math.sin(midAngle) * r;
        } else {
            let span = (angleStart - angleEnd);
            if (span < 0) span += TWO_PI;
            const midAngle = angleStart - span / 2;
            midX = center.x + Math.cos(midAngle) * r;
            midY = center.y + Math.sin(midAngle) * r;
        }
        return { x: midX, y: midY, d2: d2 };
    }

    return { x: bestX, y: bestY, d2 };
};


// --- MAIN FUNCTION ---

// Returns { x, y, distance, type: 'VERTEX' | 'MIDPOINT' | 'PROJECTION', cutIndex?, ... }
// modes: { vertex, midpoint, projection } — controls which snap types are computed
const getBestSnap = (mousePos, annotations, threshold, { vertex = true, midpoint = false, projection = false } = {}) => {
    if (!annotations || !annotations.length) return null;

    annotations = annotations.filter((ann) => !ann.outOfSnapScope);

    let bestSnap = null;
    let minDistSq = threshold * threshold;

    // =========================================================
    // 1. Check Vertices (Points) - Priority 1
    // =========================================================
    if (vertex) {
        for (const ann of annotations) {

            const pointArraysToCheck = [];

            // A. Main points (cutIndex undefined)
            if (ann.points) {
                pointArraysToCheck.push({ list: ann.points, cutIndex: undefined, source: undefined });
            }

            // B. Cut points (with cutIndex)
            if (ann.cuts && Array.isArray(ann.cuts)) {
                ann.cuts.forEach((cut, index) => {
                    if (cut.points) {
                        pointArraysToCheck.push({ list: cut.points, cutIndex: index, source: undefined });
                    }
                });
            }

            // C. Inner Steiner points (POLYGON only; treated like vertices for
            // snap-to-self drag, hover-highlight and pickup).
            if (ann.innerPoints) {
                pointArraysToCheck.push({ list: ann.innerPoints, cutIndex: undefined, source: "INNER" });
            }

            for (const { list, cutIndex, source } of pointArraysToCheck) {
                for (const pt of list) {
                    const d2 = dist2(pt, mousePos);
                    if (d2 < minDistSq) {
                        minDistSq = d2;
                        bestSnap = {
                            x: pt.x,
                            y: pt.y,
                            id: pt.id,
                            type: 'VERTEX',
                            cutIndex: cutIndex,
                            source,
                            annotationId: ann.id,
                            annotationType: ann.type,
                        };
                    }
                }
            }
        }

        if (bestSnap) return bestSnap;
    }

    // =========================================================
    // 2. Check Segments (Midpoints / Projections) - Priority 2
    // =========================================================
    if (!midpoint && !projection) return null;

    let bestFallbackProj = null;
    let minFallbackProjDistSq = Infinity;

    const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

    // Helper: process a snap candidate on a segment
    const processSegmentSnap = (projSnap, ann, segIndex, startPt, endPt, cutIdx, midSnap) => {
        // MIDPOINT: within threshold
        if (midpoint && midSnap) {
            const midD2 = dist2(mousePos, { x: midSnap.x, y: midSnap.y });
            if (midD2 < minDistSq) {
                minDistSq = midD2;
                bestSnap = {
                    x: midSnap.x, y: midSnap.y, type: 'MIDPOINT',
                    previewAnnotationId: ann.id,
                    previewSegmentIndex: segIndex,
                    segmentStartId: startPt.id,
                    segmentEndId: endPt.id,
                    cutIndex: cutIdx,
                };
            }
        }

        // PROJECTION: fallback (no threshold, closest wins)
        if (projection && projSnap && projSnap.d2 < minFallbackProjDistSq) {
            minFallbackProjDistSq = projSnap.d2;
            bestFallbackProj = {
                x: projSnap.x, y: projSnap.y, type: 'PROJECTION',
                previewAnnotationId: ann.id,
                previewSegmentIndex: segIndex,
                segmentStartId: startPt.id,
                segmentEndId: endPt.id,
                cutIndex: cutIdx,
            };
        }
    };

    // Helper: compute proj/mid for a linear segment and process
    const processLinearSegment = (mx, my, ax, ay, bx, by, ann, segIdx, startPt, endPt, cutIdx) => {
        const projSnap = projection
            ? projectOnSegment(mx, my, ax, ay, bx, by, false)
            : null;
        const midSnap = midpoint
            ? projectOnSegment(mx, my, ax, ay, bx, by, true)
            : null;
        processSegmentSnap(projSnap, ann, segIdx, startPt, endPt, cutIdx, midSnap);
    };

    // Helper: compute proj/mid for an arc segment and process
    const processArcSegment = (mx, my, center, r, startPt, endPt, isCW, ann, segIdx, cutIdx) => {
        const projSnap = projection
            ? projectOnArc(mx, my, center, r, startPt, endPt, isCW, false)
            : null;
        const midSnap = midpoint
            ? projectOnArc(mx, my, center, r, startPt, endPt, isCW, true)
            : null;
        processSegmentSnap(projSnap, ann, segIdx, startPt, endPt, cutIdx, midSnap);
    };

    for (const ann of annotations) {

        const contoursToCheck = [];

        // A. Main contour
        const mainPts = ann.points || ann.polyline?.points || ann.rectangle?.points;
        if (mainPts) {
            contoursToCheck.push({
                points: mainPts,
                shouldClose: ann.closeLine || ann.type === 'RECTANGLE' || ann.type === 'POLYGON',
                cutIndex: undefined
            });
        }

        // B. Cuts
        if (ann.cuts && Array.isArray(ann.cuts)) {
            ann.cuts.forEach((cut, index) => {
                if (cut.points) {
                    contoursToCheck.push({
                        points: cut.points,
                        shouldClose: true,
                        cutIndex: index
                    });
                }
            });
        }

        for (const contour of contoursToCheck) {
            const pts = contour.points;
            if (!Array.isArray(pts) || pts.length < 2) continue;

            const n = pts.length;
            const shouldClose = contour.shouldClose;
            const limit = shouldClose ? n : n - 1;
            const currentCutIndex = contour.cutIndex;

            const getPt = (i) => pts[(i + n) % n];

            let i = 0;
            while (i < limit) {
                const p0 = getPt(i);
                const p1 = getPt(i + 1);

                // --- S-C-S Pattern (Arcs) ---
                if (typeOf(p0) === 'square' && typeOf(p1) === 'circle') {
                    let j = i + 1;
                    while (j < i + n && typeOf(getPt(j)) === 'circle') {
                        j++;
                    }

                    if (!shouldClose && j >= n) {
                        processLinearSegment(mousePos.x, mousePos.y, p0.x, p0.y, p1.x, p1.y, ann, i, p0, p1, currentCutIndex);
                        i++;
                        continue;
                    }

                    const pNextSquare = getPt(j);

                    // Exactly one circle -> Two Arcs
                    if (j === i + 2) {
                        const p2 = pNextSquare;
                        const circ = getCircleFrom3Points(p0, p1, p2);

                        if (circ && circ.r > 0) {
                            processArcSegment(mousePos.x, mousePos.y, circ.center, circ.r, p0, p1, circ.isCW, ann, i, currentCutIndex);
                            processArcSegment(mousePos.x, mousePos.y, circ.center, circ.r, p1, p2, circ.isCW, ann, i + 1, currentCutIndex);

                            i += 2;
                            continue;
                        }
                    }

                    // Fallback: treat as linear segments
                    let k = i;
                    while (k < j) {
                        const pk = getPt(k);
                        const pkNext = getPt(k + 1);
                        processLinearSegment(mousePos.x, mousePos.y, pk.x, pk.y, pkNext.x, pkNext.y, ann, k, pk, pkNext, currentCutIndex);
                        k++;
                    }
                    i = j;
                    continue;
                }

                // --- Default: Linear Segment ---
                processLinearSegment(mousePos.x, mousePos.y, p0.x, p0.y, p1.x, p1.y, ann, i, p0, p1, currentCutIndex);

                i++;
            }
        }
    }

    // Return priority: MIDPOINT (within threshold) > PROJECTION fallback
    if (bestSnap) {
        bestSnap.distance = Math.sqrt(minDistSq);
        return bestSnap;
    }

    if (bestFallbackProj) {
        bestFallbackProj.distance = Math.sqrt(minFallbackProjDistSq);
        return bestFallbackProj;
    }

    return null;
};

export default getBestSnap;
