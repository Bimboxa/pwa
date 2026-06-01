/**
 * Reconcile metadata between an "old" cuts array (existing on the polygon)
 * and a "new" cuts array (produced by a boolean polygon op such as polygon-clipping
 * difference). The new cuts have fresh ids and generic labels; for cuts that
 * geometrically correspond to a pre-existing one, we want to preserve their
 * `id`, `label`, `type`, and `hiddenSegmentsIdx`.
 *
 * Strategy: compute centroid of each cut ring (points = [{x,y,...}]). Greedy
 * nearest-neighbor match — each new cut takes the closest unmatched old cut
 * if it falls under `maxDistance`. Otherwise the new cut keeps its generated id.
 *
 * Inputs are in pixel space (same as cutPolygonPoints output).
 *
 * @param {Array<{id, label?, type?, hiddenSegmentsIdx?, points:[{x,y}]}>} oldCuts
 * @param {Array<{id, label?, points:[{id,x,y}]}>} newCuts
 * @param {{maxDistance?: number}} [options]
 * @returns {Array} new cuts with reconciled metadata (id/label/type/hiddenSegmentsIdx)
 */
export default function reconcileCuts(oldCuts, newCuts, options = {}) {
    const maxDistance = options.maxDistance ?? 50; // pixels

    if (!newCuts || newCuts.length === 0) return [];
    if (!oldCuts || oldCuts.length === 0) return newCuts;

    const oldCentroids = oldCuts.map(centroidOfCut);
    const usedOld = new Set();

    return newCuts.map((newCut) => {
        const c = centroidOf(newCut.points);
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < oldCuts.length; i++) {
            if (usedOld.has(i)) continue;
            const oc = oldCentroids[i];
            if (!oc || !c) continue;
            const d = Math.hypot(oc.x - c.x, oc.y - c.y);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0 && bestDist <= maxDistance) {
            usedOld.add(bestIdx);
            const oldCut = oldCuts[bestIdx];
            const reconciled = {
                ...newCut,
                id: oldCut.id ?? newCut.id,
            };
            if (oldCut.label != null) reconciled.label = oldCut.label;
            if (oldCut.type != null) reconciled.type = oldCut.type;
            if (oldCut.hiddenSegmentsIdx != null) reconciled.hiddenSegmentsIdx = oldCut.hiddenSegmentsIdx;
            if (oldCut.isoHeightSegmentsIdx != null) reconciled.isoHeightSegmentsIdx = oldCut.isoHeightSegmentsIdx;
            if (oldCut.isExtEdgeSegmentsIdx != null) reconciled.isExtEdgeSegmentsIdx = oldCut.isExtEdgeSegmentsIdx;
            return reconciled;
        }
        return newCut;
    });
}

function centroidOfCut(cut) {
    return centroidOf(cut?.points);
}

function centroidOf(points) {
    if (!points || points.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const p of points) {
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
}
