import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import resolvePoints from "Features/annotations/utils/resolvePoints";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";
import { pointInPolygon } from "Features/smartDetect/utils/detectPolygonFromAnnotations";
import cutPolygonPoints from "Features/geometry/utils/cutPolygonPoints";
import reconcileCuts from "Features/geometry/utils/reconcileCuts";
import collapseArcsInPolyline from "Features/geometry/utils/collapseArcsInPolyline";
import {
    expandArcsInPath,
    extractArcCircles,
    arcUnitsToTypedPoints,
} from "Features/geometry/utils/arcSampling";
import {
    SEGMENT_FLAG_FIELDS,
    getRingSegmentFlagPointIds,
    segmentPointIdsToIdx,
    segmentIdxToPointIds,
} from "Features/annotations/utils/segmentFlags";

const BOUNDARY_EPSILON = 1.5; // pixels — distance under which a point is "on the boundary"
const ARC_SAMPLES = 12; // chords per arc half when polygonizing before the cut

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

    // Host geometry may contain S-C-S arcs. polygon-clipping is straight-line
    // only, so expand arcs into chords BEFORE the boolean op — otherwise the cut
    // runs through the chord of each arc's control points (wrong geometry) and
    // loses the curve. Arcs are recovered afterwards by collapseArcsInPolyline.
    const outerRingForCut = expandArcsInPath(outerRingPx, ARC_SAMPLES, true);
    const subjectCutsForCut = subjectCutsPx.map((c) => ({
        ...c,
        points: expandArcsInPath(c.points, ARC_SAMPLES, true),
    }));
    // The opening polygon may itself carry S-C-S arcs (e.g. a CUT_CIRCLE that
    // straddles the host boundary). Expand it to chords for the boolean op and
    // remember its arc circles so the carved edge keeps the rounding instead of
    // collapsing onto the arc control-point chords (which would leave a diamond
    // notch where the circle exits the host).
    const openingForCut = expandArcsInPath(openingPointsPx, ARC_SAMPLES, true);
    const sourceArcCircles = [
        ...extractArcCircles(outerRingPx),
        ...subjectCutsPx.flatMap((c) => extractArcCircles(c.points)),
        ...extractArcCircles(openingPointsPx),
    ];

    // Classify: are all opening corners strictly inside the (polygonized) outer
    // ring (and not within BOUNDARY_EPSILON of any outer segment)?
    const cornersFullyInside = openingForCut.every((pt) => {
        if (!pointInPolygon(pt, outerRingForCut)) return false;
        for (let i = 0; i < outerRingForCut.length; i++) {
            const a = outerRingForCut[i];
            const b = outerRingForCut[(i + 1) % outerRingForCut.length];
            const { distance } = projectPointOnSegment(pt, a, b);
            if (distance < BOUNDARY_EPSILON) return false;
        }
        return true;
    });

    if (cornersFullyInside) {
        return { handled: false };
    }

    const result = cutPolygonPoints(
        { points: outerRingForCut, cuts: subjectCutsForCut },
        openingForCut,
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

    // Normalize each cut's segment flags to effective indices before the
    // reconcile carry (id-keyed field wins — the raw row may already be
    // migrated off the legacy index arrays, see segmentFlags.js).
    const subjectCutsPxNorm = subjectCutsPx.map((c) => {
        const next = { ...c };
        for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
            const ids = getRingSegmentFlagPointIds(c, idxField, idField, c.points, {
                closed: true,
            });
            if (ids != null)
                next[idxField] = segmentPointIdsToIdx(ids, c.points, { closed: true });
            delete next[idField];
        }
        return next;
    });
    const reconciledCuts = reconcileCuts(subjectCutsPxNorm, result.cuts ?? []);

    // Recover S-C-S arcs from the dense straight rings the boolean op produced,
    // then build the new db.points entries (normalized). Each ring is a closed
    // loop; collapseArcsInPolyline scans it as a polyline, so an arc straddling
    // the (arbitrary) ring seam stays faceted — acceptable for cut contours.
    const newDbPoints = [];
    // px position of every minted ring point, keyed by its new id — lets the
    // caller re-derive geometry-based anchors (openings) on the carved ring
    // without re-reading db.points.
    const newPointsPxById = {};
    const pushRef = (p) => {
        const id = nanoid();
        newDbPoints.push({
            id,
            x: p.x / width,
            y: p.y / height,
            baseMapId,
            projectId,
            listingId,
        });
        newPointsPxById[id] = { x: p.x, y: p.y };
        return p.type === "circle" ? { id, type: "circle" } : { id };
    };
    const buildRingRefs = (pointsPx) => {
        // Only attempt arc recovery when the host actually had arcs, and require
        // each recovered run to be concentric with a known source arc. Otherwise
        // a straight opening corner (4+ vertices that happen to fit a circle)
        // would be mis-detected as a spurious arc.
        if (sourceArcCircles.length === 0) {
            return pointsPx.map(pushRef);
        }
        const units = collapseArcsInPolyline(pointsPx, {
            sourceArcCircles,
            requireSourceMatch: true,
        });
        return arcUnitsToTypedPoints(units).map(pushRef);
    };
    const newOuterPointRefs = buildRingRefs(result.points);
    const newCutEntries = reconciledCuts.map((c) => {
        const entry = { id: c.id, points: buildRingRefs(c.points) };
        if (c.label != null) entry.label = c.label;
        if (c.type != null) entry.type = c.type;
        // Positional carry converted to start-point ids on the rebuilt ring
        // (1:1 when no arcs were recovered; best-effort otherwise, as before).
        for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
            if (c[idxField] != null)
                entry[idField] = segmentIdxToPointIds(c[idxField], entry.points, {
                    closed: true,
                });
        }
        return entry;
    });

    if (newDbPoints.length > 0) {
        await db.points.bulkAdd(newDbPoints);
    }

    return {
        handled: true,
        newPointsPxById,
        updatedAnnotation: {
            ...host,
            points: newOuterPointRefs,
            cuts: newCutEntries,
            // The outer ring is fully re-minted (fresh point ids): the host's
            // segment flags cannot follow it — reset both representations.
            ...Object.fromEntries(
                SEGMENT_FLAG_FIELDS.flatMap(({ idxField, idField }) => [
                    [idxField, undefined],
                    [idField, undefined],
                ])
            ),
        },
    };
}
