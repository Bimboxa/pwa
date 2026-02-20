import polygonClipping from 'polygon-clipping';
import { nanoid } from "@reduxjs/toolkit";

const PRECISION = 8;
const EXTEND_DISTANCE = 10;
const OFFSET_DISTANCE = 10;

function coordKey(x, y) {
    return `${x.toFixed(PRECISION)}_${y.toFixed(PRECISION)}`;
}

function toRing(points) {
    const ring = points.map(p => [p.x, p.y]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([...first]);
    }
    return ring;
}

function fromRing(ring) {
    // Remove closing point (duplicate of first)
    const openRing = ring.slice(0, ring.length - 1);
    return openRing.map(p => ({ x: p[0], y: p[1] }));
}

function extendPolyline(points, distance) {
    if (points.length < 2) return points;

    const extended = [...points];

    // Extend first point backward
    const p0 = points[0];
    const p1 = points[1];
    const dx0 = p1.x - p0.x;
    const dy0 = p1.y - p0.y;
    const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    if (len0 > 0) {
        extended[0] = {
            x: p0.x - (dx0 / len0) * distance,
            y: p0.y - (dy0 / len0) * distance,
        };
    }

    // Extend last point forward
    const pN = points[points.length - 1];
    const pN1 = points[points.length - 2];
    const dxN = pN.x - pN1.x;
    const dyN = pN.y - pN1.y;
    const lenN = Math.sqrt(dxN * dxN + dyN * dyN);
    if (lenN > 0) {
        extended[extended.length - 1] = {
            x: pN.x + (dxN / lenN) * distance,
            y: pN.y + (dyN / lenN) * distance,
        };
    }

    return extended;
}

function buildHalfPlane(polylinePoints, offset) {
    // Build a polygon covering one side of the polyline.
    // Original line + offset line reversed = closed polygon (band).
    const offsetPoints = [];

    for (let i = 0; i < polylinePoints.length - 1; i++) {
        const p1 = polylinePoints[i];
        const p2 = polylinePoints[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        // Normal (perpendicular, rotated 90°)
        const nx = -dy / len;
        const ny = dx / len;

        offsetPoints.push({
            x: p1.x + nx * offset,
            y: p1.y + ny * offset,
        });

        if (i === polylinePoints.length - 2) {
            offsetPoints.push({
                x: p2.x + nx * offset,
                y: p2.y + ny * offset,
            });
        }
    }

    // For non-collinear polylines, compute miter joints
    // Simple approach: just offset each vertex
    if (polylinePoints.length > 2) {
        const offsetVertices = [];
        for (let i = 0; i < polylinePoints.length; i++) {
            const p = polylinePoints[i];

            if (i === 0) {
                const next = polylinePoints[1];
                const dx = next.x - p.x;
                const dy = next.y - p.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    offsetVertices.push({ x: p.x + (-dy / len) * offset, y: p.y + (dx / len) * offset });
                }
            } else if (i === polylinePoints.length - 1) {
                const prev = polylinePoints[i - 1];
                const dx = p.x - prev.x;
                const dy = p.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    offsetVertices.push({ x: p.x + (-dy / len) * offset, y: p.y + (dx / len) * offset });
                }
            } else {
                // Average of two segment normals
                const prev = polylinePoints[i - 1];
                const next = polylinePoints[i + 1];
                const dx1 = p.x - prev.x, dy1 = p.y - prev.y;
                const dx2 = next.x - p.x, dy2 = next.y - p.y;
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (len1 > 0 && len2 > 0) {
                    const nx1 = -dy1 / len1, ny1 = dx1 / len1;
                    const nx2 = -dy2 / len2, ny2 = dx2 / len2;
                    const nx = (nx1 + nx2) / 2, ny = (ny1 + ny2) / 2;
                    const nlen = Math.sqrt(nx * nx + ny * ny);
                    if (nlen > 0) {
                        offsetVertices.push({ x: p.x + (nx / nlen) * offset, y: p.y + (ny / nlen) * offset });
                    }
                }
            }
        }

        // Build closed polygon: original forward + offset reversed
        return [...polylinePoints, ...offsetVertices.reverse()];
    }

    // Simple 2-point case
    return [...polylinePoints, ...offsetPoints.reverse()];
}

/**
 * Split a polygon into two pieces using a cutting polyline.
 *
 * @param {Array<{id, x, y}>} polygonPoints - Polygon vertices (relative 0-1 coords)
 * @param {Array<{x, y}>} cuttingPoints - Cutting polyline vertices (relative 0-1 coords)
 * @returns {{ piece1: Array<{id, x, y}>, piece2: Array<{id, x, y}>, newPoints: Array<{id, x, y}> } | null}
 */
export default function splitPolygonByPolyline(polygonPoints, cuttingPoints) {
    if (!polygonPoints || polygonPoints.length < 3 || !cuttingPoints || cuttingPoints.length < 2) {
        return null;
    }

    try {
        // 1. Extend cutting line beyond polygon bounds
        const extended = extendPolyline(cuttingPoints, EXTEND_DISTANCE);

        // 2. Build half-plane polygon
        const halfPlane = buildHalfPlane(extended, OFFSET_DISTANCE);

        // 3. Convert to polygon-clipping format
        const polyRing = toRing(polygonPoints);
        const halfPlaneRing = toRing(halfPlane);

        // 4. Compute the two pieces
        const piece1Result = polygonClipping.intersection([[polyRing]], [[halfPlaneRing]]);
        const piece2Result = polygonClipping.difference([[polyRing]], [[halfPlaneRing]]);

        if (!piece1Result.length || !piece2Result.length) {
            console.warn("[splitPolygonByPolyline] Split failed — cutting line does not divide the polygon");
            return null;
        }

        // Take the exterior ring of the first polygon in each result
        const piece1Coords = fromRing(piece1Result[0][0]);
        const piece2Coords = fromRing(piece2Result[0][0]);

        if (piece1Coords.length < 3 || piece2Coords.length < 3) {
            return null;
        }

        // 5. Point reconciliation
        // Build lookup: coordKey → pointId for original polygon points
        const knownPoints = new Map();
        for (const p of polygonPoints) {
            knownPoints.set(coordKey(p.x, p.y), p.id);
        }

        // Cutting line points: create IDs (these will be shared between both pieces)
        for (const p of cuttingPoints) {
            const key = coordKey(p.x, p.y);
            if (!knownPoints.has(key)) {
                knownPoints.set(key, nanoid());
            }
        }

        // Track which points are newly created (need DB insertion)
        const newPointIds = new Set();
        const originalPointIds = new Set(polygonPoints.map(p => p.id));

        function resolvePoint(p) {
            const key = coordKey(p.x, p.y);
            if (knownPoints.has(key)) {
                const id = knownPoints.get(key);
                if (!originalPointIds.has(id)) {
                    newPointIds.add(id);
                }
                return { id, x: p.x, y: p.y };
            }
            // New intersection point
            const id = nanoid();
            knownPoints.set(key, id);
            newPointIds.add(id);
            return { id, x: p.x, y: p.y };
        }

        const piece1 = piece1Coords.map(resolvePoint);
        const piece2 = piece2Coords.map(resolvePoint);

        // Collect all new points that need DB insertion
        const newPoints = [];
        for (const id of newPointIds) {
            // Find the coordinates from our resolved pieces
            const found = [...piece1, ...piece2].find(p => p.id === id);
            if (found) {
                newPoints.push({ id: found.id, x: found.x, y: found.y });
            }
        }

        return { piece1, piece2, newPoints };

    } catch (error) {
        console.error("[splitPolygonByPolyline] Error:", error);
        return null;
    }
}
