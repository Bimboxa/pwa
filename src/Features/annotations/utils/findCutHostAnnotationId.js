import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";

const HOST_TYPES = ["POLYGON", "STRIP", "POLYLINE"];

const isFinitePt = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

const centroidOf = (pts) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const p of pts) {
        if (!isFinitePt(p)) continue;
        sx += p.x;
        sy += p.y;
        n += 1;
    }
    return n > 0 ? { x: sx / n, y: sy / n } : null;
};

const ringArea = (ring) => {
    let s = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s / 2);
};

const pointInsidePolygon = (pt, polygon) => {
    const outer = polygon?.points;
    if (!outer || outer.length < 3) return false;
    if (!pointInPolygon(pt, outer)) return false;
    for (const cut of polygon.cuts ?? []) {
        if (cut?.points?.length >= 3 && pointInPolygon(pt, cut.points)) {
            return false;
        }
    }
    return true;
};

/**
 * Geometric fallback for the CUT/opening tool: pick the annotation a freshly
 * drawn opening belongs to, when the host was NOT captured by the first-click
 * DOM hit-test in InteractionLayer (e.g. the user starts the rectangle on the
 * polygon border instead of inside it).
 *
 * Mirrors the DOM hit-test: among the visible POLYGON / STRIP / POLYLINE
 * annotations the opening overlaps, return the one with the smallest area
 * (the tightest enclosing shape wins, consistent with picking the polygon
 * directly under the pointer).
 *
 * @param {Object}   args
 * @param {Array<{x:number,y:number}>} args.openingPx  Drawn opening in pixel space.
 * @param {Array<Object>} args.annotations             Pixel-resolved visible annotations (useAnnotationsV2).
 * @param {number}   [args.meterByPx]                  For STRIP/POLYLINE polygonization.
 * @returns {string|null} host annotation id, or null when none matches.
 */
export default function findCutHostAnnotationId({
    openingPx,
    annotations,
    meterByPx,
}) {
    if (!openingPx || openingPx.length < 3 || !Array.isArray(annotations)) {
        return null;
    }
    const center = centroidOf(openingPx);
    if (!center) return null;
    const corners = openingPx.filter(isFinitePt);

    let bestId = null;
    let bestArea = Infinity;

    for (const annotation of annotations) {
        if (!HOST_TYPES.includes(annotation?.type) || !annotation?.id) continue;

        const polygons = getAnnotationAsPolygons(annotation, { meterByPx });
        for (const polygon of polygons) {
            // The opening belongs to a polygon if its centroid sits inside it,
            // or (rectangle straddling the border) any of its corners does.
            const matches =
                pointInsidePolygon(center, polygon) ||
                corners.some((c) => pointInsidePolygon(c, polygon));
            if (!matches) continue;

            const area = ringArea(polygon.points);
            if (area < bestArea) {
                bestArea = area;
                bestId = annotation.id;
            }
        }
    }

    return bestId;
}
