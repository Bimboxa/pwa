import db from "App/db/db";
import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";
import cutPolygonPoints from "Features/geometry/utils/cutPolygonPoints";
import reconcileCuts from "Features/geometry/utils/reconcileCuts";

const BOUNDARY_EPSILON = 1.5; // pixels — distance under which a point is "on the boundary"

/**
 * Apply an "opening" polygon on a host polygon annotation:
 *   - When the opening sits strictly inside the host's outer ring, return
 *     { handled: false } so the caller can keep its current behavior (e.g.
 *     append the opening as an inner-ring cut, or leave an existing cut as-is).
 *   - When the opening touches or exits the outer ring, run a boolean
 *     difference (outer + other cuts) - opening and return an updated
 *     annotation with the carved outer contour and the surviving cuts.
 *
 * Used by:
 *   - useHandleCommitDrawing.js (rectangle/click drawing tools for CUT)
 *   - handlePointMoveCommit (vertex drag on a cut)
 *
 * @param {object} args
 * @param {object} args.host                Polygon annotation (raw, with point refs).
 * @param {Array<{x:number,y:number}>} args.openingPointsPx
 *                                          Opening polygon in pixel space (>=3 points).
 * @param {{width:number,height:number}} args.imageSize
 * @param {string} args.baseMapId
 * @param {string} args.projectId
 * @param {string} args.listingId
 * @param {string} [args.excludeCutId]      If provided, this cut is filtered out
 *                                          of the host before computing the
 *                                          difference. Used when reflowing a cut
 *                                          whose vertices were just dragged.
 * @returns {Promise<{handled:boolean, updatedAnnotation?:object}>}
 */
export default async function applyOpeningOnPolygon({
    host,
    openingPointsPx,
    imageSize,
    baseMapId,
    projectId,
    listingId,
    excludeCutId,
}) {
    const { width, height } = imageSize ?? {};
    if (!host?.points || host.points.length < 3) return { handled: false };
    if (!openingPointsPx || openingPointsPx.length < 3 || !width || !height) {
        return { handled: false };
    }

    // Load all points referenced by the host annotation (outer ring + cuts).
    const hostPointIds = new Set();
    for (const p of host.points) if (p?.id) hostPointIds.add(p.id);
    for (const c of host.cuts ?? []) {
        for (const p of c.points ?? []) if (p?.id) hostPointIds.add(p.id);
    }
    const pointsArr = await db.points.bulkGet([...hostPointIds]);
    const pointsIndex = {};
    for (const p of pointsArr) if (p) pointsIndex[p.id] = p;

    const outerRingPx = resolvePoints({
        points: host.points,
        pointsIndex,
        imageSize,
    });
    if (!outerRingPx || outerRingPx.length < 3) return { handled: false };

    // If any host point failed to resolve to finite coordinates, its
    // db.points entry is missing (orphaned / soft-deleted / not synced).
    // Proceeding would feed NaN geometry to polygon-clipping and then
    // re-add existing point ids via bulkAdd (Dexie BulkError + crash).
    const unresolvedIds = host.points
        .filter((ref, i) => {
            const p = outerRingPx[i];
            return !Number.isFinite(p?.x) || !Number.isFinite(p?.y);
        })
        .map((ref) => ref?.id);
    if (unresolvedIds.length > 0) {
        console.warn(
            `[CUT] Aborted: host annotation ${host?.id} has unresolved points ` +
                `${JSON.stringify(unresolvedIds)} — opening not applied.`
        );
        return { handled: true };
    }

    const allCutsPx = resolveCuts({
        cuts: host.cuts,
        pointsIndex,
        imageSize,
    }) ?? [];
    const subjectCutsPx = excludeCutId
        ? allCutsPx.filter((c) => c.id !== excludeCutId)
        : allCutsPx;

    // Classify: are all opening corners strictly inside the outer ring
    // (and not within BOUNDARY_EPSILON of any outer segment)?
    const cornersFullyInside = openingPointsPx.every((pt) => {
        if (!pointInPolygon(pt, outerRingPx)) return false;
        for (let i = 0; i < outerRingPx.length; i++) {
            const a = outerRingPx[i];
            const b = outerRingPx[(i + 1) % outerRingPx.length];
            const { distance } = projectPointOnSegment(pt, a, b);
            if (distance < BOUNDARY_EPSILON) return false;
        }
        return true;
    });

    if (cornersFullyInside) {
        return { handled: false };
    }

    const result = cutPolygonPoints(
        { points: outerRingPx, cuts: subjectCutsPx },
        openingPointsPx,
        { splitMode: "abort" }
    );

    if (result.error) {
        console.warn(
            `[CUT] Aborted: host annotation ${host?.id} has invalid/unresolved ` +
                `geometry — opening not applied.`
        );
        return { handled: true };
    }
    if (result.aborted) {
        console.warn(
            "[CUT] Aborted: opening would split the polygon into multiple pieces."
        );
        return { handled: true };
    }
    if (!result.points || result.points.length < 3) {
        console.warn("[CUT] Aborted: opening leaves an empty polygon.");
        return { handled: true };
    }

    const reconciledCuts = reconcileCuts(subjectCutsPx, result.cuts ?? []);

    // Build the new db.points entries (normalized) for the new outer ring + each cut ring.
    const newDbPoints = [];
    const pushPoint = (p) => {
        newDbPoints.push({
            id: p.id,
            x: p.x / width,
            y: p.y / height,
            baseMapId,
            projectId,
            listingId,
        });
        return { id: p.id };
    };
    const newOuterPointRefs = result.points.map(pushPoint);
    const newCutEntries = reconciledCuts.map((c) => {
        const entry = { id: c.id, points: c.points.map(pushPoint) };
        if (c.label != null) entry.label = c.label;
        if (c.type != null) entry.type = c.type;
        if (c.hiddenSegmentsIdx != null) entry.hiddenSegmentsIdx = c.hiddenSegmentsIdx;
        return entry;
    });

    if (newDbPoints.length > 0) {
        await db.points.bulkAdd(newDbPoints);
    }

    return {
        handled: true,
        updatedAnnotation: {
            ...host,
            points: newOuterPointRefs,
            cuts: newCutEntries,
        },
    };
}
