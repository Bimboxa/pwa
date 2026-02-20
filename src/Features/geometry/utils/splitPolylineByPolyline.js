import { nanoid } from "@reduxjs/toolkit";

/**
 * Find the intersection of two line segments (p1-p2) and (p3-p4).
 * Returns { x, y, t, u } or null if no intersection.
 * t is the parameter along segment p1-p2, u along p3-p4 (both in [0,1]).
 */
function segmentIntersection(p1, p2, p3, p4) {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-12) return null; // Parallel

    const dpx = p3.x - p1.x;
    const dpy = p3.y - p1.y;

    const t = (dpx * d2y - dpy * d2x) / cross;
    const u = (dpx * d1y - dpy * d1x) / cross;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: p1.x + t * d1x,
            y: p1.y + t * d1y,
            t,
            u,
        };
    }
    return null;
}

/**
 * Split a polyline into two pieces using a cutting polyline.
 * Finds the first intersection point and splits there.
 *
 * @param {Array<{id, x, y}>} polylinePoints - Host polyline vertices (relative 0-1 coords)
 * @param {Array<{x, y}>} cuttingPoints - Cutting polyline vertices (relative 0-1 coords)
 * @returns {{ piece1: Array<{id, x, y}>, piece2: Array<{id, x, y}>, newPoints: Array<{id, x, y}> } | null}
 */
export default function splitPolylineByPolyline(polylinePoints, cuttingPoints) {
    if (!polylinePoints || polylinePoints.length < 2 || !cuttingPoints || cuttingPoints.length < 2) {
        return null;
    }

    // Find the first intersection
    let bestIntersection = null;
    let bestHostSegIndex = -1;

    for (let i = 0; i < polylinePoints.length - 1 && !bestIntersection; i++) {
        const hostA = polylinePoints[i];
        const hostB = polylinePoints[i + 1];

        for (let j = 0; j < cuttingPoints.length - 1; j++) {
            const cutA = cuttingPoints[j];
            const cutB = cuttingPoints[j + 1];

            const inter = segmentIntersection(hostA, hostB, cutA, cutB);
            if (inter) {
                bestIntersection = inter;
                bestHostSegIndex = i;
                break;
            }
        }
    }

    if (!bestIntersection || bestHostSegIndex < 0) {
        console.warn("[splitPolylineByPolyline] No intersection found");
        return null;
    }

    // Create a shared intersection point
    const sharedPointId = nanoid();
    const sharedPoint = { id: sharedPointId, x: bestIntersection.x, y: bestIntersection.y };

    // Split the polyline at the intersection
    // piece1: points[0..bestHostSegIndex] + intersection point
    // piece2: intersection point + points[bestHostSegIndex+1..n]
    const piece1 = [
        ...polylinePoints.slice(0, bestHostSegIndex + 1),
        sharedPoint,
    ];

    const piece2 = [
        sharedPoint,
        ...polylinePoints.slice(bestHostSegIndex + 1),
    ];

    const newPoints = [sharedPoint];

    return { piece1, piece2, newPoints };
}
