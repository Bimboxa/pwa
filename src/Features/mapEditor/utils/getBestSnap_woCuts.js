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

    // 1. Calculate Normal Projection (for distance check)
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

    // 2. If forceCenter, return Midpoint but keep the Projection Distance
    // This allows snapping to the center even if mouse is far from center, 
    // as long as it is close to the line.
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
    if (Math.abs(D) < 1e-9) return null; // Collinear

    const x1sq_y1sq = x1 * x1 + y1 * y1;
    const x2sq_y2sq = x2 * x2 + y2 * y2;
    const x3sq_y3sq = x3 * x3 + y3 * y3;

    const ux = (x1sq_y1sq * (y2 - y3) + x2sq_y2sq * (y3 - y1) + x3sq_y3sq * (y1 - y2)) / D;
    const uy = (x1sq_y1sq * (x3 - x2) + x2sq_y2sq * (x1 - x3) + x3sq_y3sq * (x2 - x1)) / D;

    const center = { x: ux, y: uy };
    const r = Math.hypot(x1 - ux, y1 - uy);

    // Cross product to determine winding order (CW vs CCW)
    const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
    const isCW = cross > 0;

    return { center, r, isCW };
};

// Project point P onto an arc defined by Center, Radius, Start, End, and Winding.
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

    // 1. Project to the infinite circle perimeter
    // If point is exactly at center, project to start (arbitrary but safe)
    const projX = dist === 0 ? start.x : center.x + (dx / dist) * r;
    const projY = dist === 0 ? start.y : center.y + (dy / dist) * r;

    // 2. Check if this projected point lies within the angular span of the arc
    const angleAt = Math.atan2(projY - center.y, projX - center.x);

    // We calculate the relative angle from start in CCW direction
    let relPoint = normalize(angleAt - angleStart);
    let relEndCCW = normalize(angleEnd - angleStart);

    let inArc = false;

    if (isCW) {
        // If arc is CW: Start -> End is "backwards". 
        // In CCW terms, the arc covers the complement of [Start -> End CCW].
        // So if the point is NOT in the CCW range, it is in the CW arc.
        if (relPoint > relEndCCW) {
            inArc = true;
        }
    } else {
        // If arc is CCW: Start -> End matches CCW logic.
        if (relPoint < relEndCCW) {
            inArc = true;
        }
    }

    // Final Point Selection
    let bestX, bestY;

    if (inArc) {
        bestX = projX;
        bestY = projY;
    } else {
        // Clamp to nearest endpoint
        const dStart = dist2({ x: px, y: py }, start);
        const dEnd = dist2({ x: px, y: py }, end);
        if (dStart < dEnd) {
            bestX = start.x;
            bestY = start.y;
        } else {
            bestX = end.x;
            bestY = end.y;
        }
    }

    const d2 = dist2({ x: px, y: py }, { x: bestX, y: bestY });

    // 3. If forceCenter, return Midpoint but use Projection Distance
    if (forceCenter) {
        let midX, midY;
        if (isCW) {
            let spanCW = (angleStart - angleEnd);
            if (spanCW < 0) spanCW += TWO_PI;
            const midAngle = angleStart - spanCW / 2;
            midX = center.x + Math.cos(midAngle) * r;
            midY = center.y + Math.sin(midAngle) * r;
        } else {
            let spanCCW = (angleEnd - angleStart);
            if (spanCCW < 0) spanCCW += TWO_PI;
            const midAngle = angleStart + spanCCW / 2;
            midX = center.x + Math.cos(midAngle) * r;
            midY = center.y + Math.sin(midAngle) * r;
        }
        return { x: midX, y: midY, d2: d2 };
    }

    return { x: bestX, y: bestY, d2 };
};


// --- MAIN FUNCTION ---

// Returns { x, y, distance, type: 'VERTEX' | 'PROJECTION' } or null
const getBestSnap = (mousePos, annotations, threshold, forceCenter = false) => {
    if (!annotations || !annotations.length) return null;

    // remote outOfScope annotations
    annotations = annotations.filter((ann) => !ann.outOfSnapScope);

    let bestSnap = null;
    let minDistSq = threshold * threshold;

    // 1. Check Vertices (Points) - Priority 1
    for (const ann of annotations) {
        // Check main points
        if (ann.points) {
            for (const pt of ann.points) {
                const d2 = dist2(pt, mousePos);
                if (d2 < minDistSq) {
                    minDistSq = d2;
                    bestSnap = { x: pt.x, y: pt.y, id: pt.id, type: 'VERTEX' };
                }
            }
        }
    }

    // If we found a vertex, return it immediately (it beats edges)
    if (bestSnap) return bestSnap;


    // 2. Check Segments/Projections (Edges/Arcs) - Priority 2
    // We iterate looking for the Square -> Circle -> Square pattern

    const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

    for (const ann of annotations) {
        const pts = ann.points || ann.polyline?.points || ann.rectangle?.points;
        if (!Array.isArray(pts) || pts.length < 2) continue;

        const n = pts.length;
        const shouldClose = ann.closeLine || ann.type === 'RECTANGLE';
        const limit = shouldClose ? n : n - 1;

        // Helper to get point at index with wrap-around
        const getPt = (i) => pts[(i + n) % n];

        let i = 0;
        while (i < limit) {
            const p0 = getPt(i);
            const p1 = getPt(i + 1);

            // Check S-C-S Pattern (Square -> Circle -> ... -> Square)
            if (typeOf(p0) === 'square' && typeOf(p1) === 'circle') {

                // Find the next square to complete the sequence
                let j = i + 1;
                // Advance while we see circles
                while (j < i + n && typeOf(getPt(j)) === 'circle') {
                    j++;
                }

                // Ensure we didn't run off the end of an open line
                if (!shouldClose && j >= n) {
                    // Fallback: treat current p0-p1 as linear segment
                    const snap = projectOnSegment(mousePos.x, mousePos.y, p0.x, p0.y, p1.x, p1.y, forceCenter);
                    if (snap.d2 < minDistSq) {
                        minDistSq = snap.d2;
                        bestSnap = {
                            x: snap.x, y: snap.y, type: 'PROJECTION',
                            previewAnnotationId: ann.id,
                            previewSegmentIndex: i, // Index of Start Point
                            segmentStartId: p0.id,
                            segmentEndId: p1.id
                        };
                    }
                    i++;
                    continue;
                }

                const pNextSquare = getPt(j);

                // Specifically handle the S-C-S (Exactly one circle in between) 
                // This matches the MapEditorGeneric logic for arcs.
                if (j === i + 2) {
                    const p2 = pNextSquare;

                    // Calculate Circle Geometry
                    const circ = getCircleFrom3Points(p0, p1, p2);

                    if (circ && circ.r > 0) {
                        // We have two arcs: P0 -> P1 and P1 -> P2. Check both.

                        // Arc 1: P0 -> P1
                        const snap1 = projectOnArc(mousePos.x, mousePos.y, circ.center, circ.r, p0, p1, circ.isCW, forceCenter);
                        if (snap1.d2 < minDistSq) {
                            minDistSq = snap1.d2;
                            bestSnap = {
                                x: snap1.x, y: snap1.y, type: 'PROJECTION',
                                previewAnnotationId: ann.id,
                                previewSegmentIndex: i,
                                segmentStartId: p0.id,
                                segmentEndId: p1.id
                            };
                        }

                        // Arc 2: P1 -> P2
                        const snap2 = projectOnArc(mousePos.x, mousePos.y, circ.center, circ.r, p1, p2, circ.isCW, forceCenter);
                        if (snap2.d2 < minDistSq) {
                            minDistSq = snap2.d2;
                            bestSnap = {
                                x: snap2.x, y: snap2.y, type: 'PROJECTION',
                                previewAnnotationId: ann.id,
                                previewSegmentIndex: i + 1, // P1 is the start of this segment
                                segmentStartId: p1.id,
                                segmentEndId: p2.id
                            };
                        }

                        i += 2; // Consumed P0->P1 and P1->P2
                        continue;
                    }
                }

                // If we had multiple circles (S-C-C-S) or degenerate circle, 
                // treat intermediate segments as lines (matching MapEditorGeneric fallback)
                let k = i;
                while (k < j) {
                    const pk = getPt(k);
                    const pkNext = getPt(k + 1);
                    const snap = projectOnSegment(mousePos.x, mousePos.y, pk.x, pk.y, pkNext.x, pkNext.y, forceCenter);
                    if (snap.d2 < minDistSq) {
                        minDistSq = snap.d2;
                        bestSnap = {
                            x: snap.x, y: snap.y, type: 'PROJECTION',
                            previewAnnotationId: ann.id,
                            previewSegmentIndex: k,
                            segmentStartId: pk.id,
                            segmentEndId: pkNext.id
                        };
                    }
                    k++;
                }

                // Advance main loop to the square we found
                i = j;
                continue;
            }

            // Default: Linear Segment (Square -> Square, or others)
            const snap = projectOnSegment(mousePos.x, mousePos.y, p0.x, p0.y, p1.x, p1.y, forceCenter);
            if (snap.d2 < minDistSq) {
                minDistSq = snap.d2;
                bestSnap = {
                    x: snap.x, y: snap.y, type: 'PROJECTION',
                    previewAnnotationId: ann.id,
                    previewSegmentIndex: i,
                    segmentStartId: p0.id,
                    segmentEndId: p1.id
                };
            }

            i++;
        }
    }

    // Calculate standard distance for return object (instead of squared)
    if (bestSnap) {
        bestSnap.distance = Math.sqrt(minDistSq);
    }

    return bestSnap;
};

export default getBestSnap;