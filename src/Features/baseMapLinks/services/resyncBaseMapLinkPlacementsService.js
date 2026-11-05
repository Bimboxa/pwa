import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import computeVerticalBaseMapPlacementFromLink from "Features/baseMaps/js/computeVerticalBaseMapPlacementFromLink";
import {
  computeKeepScaleClonePoints,
  getBaseMapLinkWorldLength,
} from "Features/baseMaps/js/computeBaseMapLinkCloneGeometry";

import getHydratedBaseMap from "./getHydratedBaseMap";

// Single writer of the 3D pose (+ scale) of every VERTICAL base map that
// hosts the CLONE of a BASE_MAP_LINK section mark.
//
// The plan segment (source link) and its clone on the elevation are the
// source of truth: drawing the clone, or moving either segment afterwards,
// re-poses that elevation so the clone lands on the plan segment, with the
// observer on the arrows' side. Everything downstream — the 3D groups
// (useApplyBaseMapTransformsIn3d), the 2D scale consumers (cotes, CM
// strokes) — reacts to the triggers dispatched at the end.
//
// Two modes, chosen when the clone is drawn (`clone.adaptScale`):
//   - adapt (true / undefined = legacy clones): the elevation scale is
//     recomputed so the clone spans exactly the plan mark;
//   - keep (false): the elevation keeps its scale. The clone's FIRST point is
//     the anchor, the second one only gives the side; that far point is
//     DERIVED (horizontal, at the mark's true length at the base map scale)
//     and rewritten here whenever the mark, the anchor or the scale changed.
//     An elevation that lost its scale falls back to adapt for the run.
//
// This service ONLY ever writes VERTICAL base maps (and the far point of a
// keep-scale clone), and only when something actually moved (EPS guards).
// Same anti-loop discipline as resyncRevolutionAxisPlacementsService: readers
// never write back, a second run finds no delta and writes nothing.
//
// Several links may target the same elevation: each one may carry a clone,
// and the last clone committed / moved wins the pose.
const EPS = 1e-6;
const EPS_NORM = 1e-9;

const sameNumber = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < EPS;

const samePose = (record, next) =>
  sameNumber(record?.angleDeg, next.angleDeg) &&
  sameNumber(record?.position?.x, next.position.x) &&
  sameNumber(record?.position?.y, next.position.y) &&
  sameNumber(record?.position?.z, next.position.z);

const isClone = (a) =>
  a && !a.deletedAt && a.type === "BASE_MAP_LINK" && a.sourceLinkAnnotationId;

const isKeepScaleClone = (a) => isClone(a) && a.adaptScale === false;

/**
 * Re-pose the vertical base maps driven by BASE_MAP_LINK clones.
 *
 * @param {Object} params
 * @param {string} [params.cloneId]       re-pose just this clone's elevation
 * @param {string} [params.sourceLinkId]  re-pose every clone of this link
 * @param {string} [params.planBaseMapId] re-pose every clone of every link
 *                                        hosted by this plan base map
 * @param {string} [params.elevationBaseMapId] re-run the KEEP-SCALE clones
 *                                        hosted by this vertical base map
 *                                        (after its scale was edited by hand;
 *                                        adapt clones are left alone — they
 *                                        would overwrite that edit)
 * @param {Function} [params.dispatch]    redux dispatch (to notify 2D / 3D)
 * @returns {Promise<number>} how many base maps actually changed
 */
export default async function resyncBaseMapLinkPlacementsService({
  cloneId,
  sourceLinkId,
  planBaseMapId,
  elevationBaseMapId,
  dispatch,
} = {}) {
  // --- resolve the clones to re-pose ---

  let clones = [];
  if (cloneId) {
    const one = await db.annotations.get(cloneId);
    if (isClone(one)) clones = [one];
  } else if (elevationBaseMapId) {
    clones = await db.annotations
      .where("baseMapId")
      .equals(elevationBaseMapId)
      .filter(isKeepScaleClone)
      .toArray();
    // The clone that currently drives the pose runs last: it keeps it.
    const record = await db.baseMaps.get(elevationBaseMapId);
    const driverId = record?.poseSourceAnnotationId;
    clones.sort(
      (a, b) => Number(a.id === driverId) - Number(b.id === driverId)
    );
  } else {
    const sourceIds = [];
    if (sourceLinkId) {
      sourceIds.push(sourceLinkId);
    } else if (planBaseMapId) {
      const links = await db.annotations
        .where("baseMapId")
        .equals(planBaseMapId)
        .filter(
          (a) =>
            !a.deletedAt &&
            a.type === "BASE_MAP_LINK" &&
            !a.sourceLinkAnnotationId
        )
        .toArray();
      sourceIds.push(...links.map((a) => a.id));
    }
    if (sourceIds.length === 0) return 0;

    clones = await db.annotations
      .filter((a) => isClone(a) && sourceIds.includes(a.sourceLinkAnnotationId))
      .toArray();
  }

  if (clones.length === 0) return 0;

  // --- solve + write ---

  const sourceCache = new Map();
  const baseMapCache = new Map();
  const getBaseMap = async (id) => {
    if (!id) return null;
    if (!baseMapCache.has(id))
      baseMapCache.set(id, await getHydratedBaseMap(id));
    return baseMapCache.get(id);
  };

  let changed = 0;
  let pointsChanged = false;
  // Elevations whose scale this run rewrote: their keep-scale clones were
  // drawn at the previous scale and must be re-run afterwards.
  const rescaledBaseMapIds = new Set();

  for (const clone of clones) {
    const sId = clone.sourceLinkAnnotationId;
    if (!sId || !clone.baseMapId) continue;
    if (clone.points?.length !== 2) continue;

    if (!sourceCache.has(sId))
      sourceCache.set(sId, await db.annotations.get(sId));
    const source = sourceCache.get(sId);
    if (!source || source.deletedAt || source.points?.length !== 2) continue;
    // A clone left on a base map the link no longer targets is inert.
    if (source.linkedBaseMapId !== clone.baseMapId) continue;

    const [p1, p2, q1, q2] = await db.points.bulkGet([
      source.points[0].id,
      source.points[1].id,
      clone.points[0].id,
      clone.points[1].id,
    ]);
    if (!p1 || !p2 || !q1 || !q2) continue;

    const planBaseMap = await getBaseMap(source.baseMapId);
    const elevationBaseMap = await getBaseMap(clone.baseMapId);
    if (!planBaseMap || !elevationBaseMap) continue;

    const planNorm = { p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } };
    let cloneNorm = { q1: { x: q1.x, y: q1.y }, q2: { x: q2.x, y: q2.y } };

    const elevationMeterByPx = elevationBaseMap.getMeterByPx?.();
    const keepScale = clone.adaptScale === false && elevationMeterByPx > 0;

    if (keepScale) {
      // Re-derive the far point: horizontal, at the mark's true length.
      const size = elevationBaseMap.getImageSize?.();
      const lengthM = getBaseMapLinkWorldLength({ planBaseMap, planNorm });
      if (!size?.width || !size?.height || !lengthM) continue;
      const kept = computeKeepScaleClonePoints({
        anchorPx: { x: q1.x * size.width, y: q1.y * size.height },
        directionPx: { x: q2.x * size.width, y: q2.y * size.height },
        lengthM,
        meterByPx: elevationMeterByPx,
      });
      if (!kept) continue;
      const far = {
        x: kept.farPx.x / size.width,
        y: kept.farPx.y / size.height,
      };
      if (
        Math.abs(far.x - q2.x) > EPS_NORM ||
        Math.abs(far.y - q2.y) > EPS_NORM
      ) {
        await db.points.update(q2.id, far);
        pointsChanged = true;
      }
      cloneNorm = { q1: cloneNorm.q1, q2: far };
    }

    const next = computeVerticalBaseMapPlacementFromLink({
      planBaseMap,
      elevationBaseMap,
      planNorm,
      cloneNorm,
      keepScale,
    });
    if (!next) continue;

    const record = await db.baseMaps.get(clone.baseMapId);
    const scaleChanged =
      !keepScale && !sameNumber(record?.meterByPx, next.meterByPx);
    if (samePose(record, next) && !scaleChanged) continue;

    await db.baseMaps.update(clone.baseMapId, {
      angleDeg: next.angleDeg,
      position: next.position,
      // keep mode never touches the scale
      ...(keepScale ? {} : { meterByPx: next.meterByPx }),
      // Provenance, same contract as the revolution-axis pose writer.
      poseSource: "BASE_MAP_LINK",
      poseSourceAnnotationId: clone.id,
    });
    baseMapCache.delete(clone.baseMapId);
    if (scaleChanged) rescaledBaseMapIds.add(clone.baseMapId);
    changed += 1;
  }

  // Keep-scale clones sharing an elevation that was just rescaled: redraw
  // their far point at the new scale (points only — the clone that rescaled
  // keeps the pose).
  for (const baseMapId of rescaledBaseMapIds) {
    const moved = await redrawKeepScaleClonesOfBaseMap(baseMapId);
    if (moved) pointsChanged = true;
  }

  if (dispatch) {
    if (changed > 0) {
      dispatch(triggerBaseMapsUpdate());
      // meterByPx is read by the 2D scale consumers through
      // entitiesTableUpdatedAt.baseMaps (useBaseMaps / useAnnotationsV2).
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
    }
    if (pointsChanged) dispatch(triggerAnnotationsUpdate());
  }
  return changed;
}

// Rewrites the derived far point of every keep-scale clone hosted by a
// vertical base map, at that base map's current scale. No pose write.
async function redrawKeepScaleClonesOfBaseMap(baseMapId) {
  const clones = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .filter(isKeepScaleClone)
    .toArray();
  if (clones.length === 0) return false;

  const elevationBaseMap = await getHydratedBaseMap(baseMapId);
  const meterByPx = elevationBaseMap?.getMeterByPx?.();
  const size = elevationBaseMap?.getImageSize?.();
  if (!(meterByPx > 0) || !size?.width || !size?.height) return false;

  let moved = false;
  for (const clone of clones) {
    if (clone.points?.length !== 2) continue;
    const source = await db.annotations.get(clone.sourceLinkAnnotationId);
    if (!source || source.deletedAt || source.points?.length !== 2) continue;
    const [p1, p2, q1, q2] = await db.points.bulkGet([
      source.points[0].id,
      source.points[1].id,
      clone.points[0].id,
      clone.points[1].id,
    ]);
    if (!p1 || !p2 || !q1 || !q2) continue;
    const planBaseMap = await getHydratedBaseMap(source.baseMapId);
    const lengthM = getBaseMapLinkWorldLength({
      planBaseMap,
      planNorm: { p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } },
    });
    if (!lengthM) continue;
    const kept = computeKeepScaleClonePoints({
      anchorPx: { x: q1.x * size.width, y: q1.y * size.height },
      directionPx: { x: q2.x * size.width, y: q2.y * size.height },
      lengthM,
      meterByPx,
    });
    if (!kept) continue;
    const far = {
      x: kept.farPx.x / size.width,
      y: kept.farPx.y / size.height,
    };
    if (
      Math.abs(far.x - q2.x) > EPS_NORM ||
      Math.abs(far.y - q2.y) > EPS_NORM
    ) {
      await db.points.update(q2.id, far);
      moved = true;
    }
  }
  return moved;
}

/**
 * Cheap post-commit hook for the point-move paths: re-pose whatever the
 * moved annotations drive. No-op for annotations that are not BASE_MAP_LINK.
 */
export async function resyncBaseMapLinksForAnnotationIds({
  annotationIds,
  dispatch,
} = {}) {
  const ids = [...new Set((annotationIds ?? []).filter(Boolean))];
  if (ids.length === 0) return 0;
  const rows = (await db.annotations.bulkGet(ids)).filter(
    (a) => a && !a.deletedAt && a.type === "BASE_MAP_LINK"
  );
  let changed = 0;
  for (const a of rows) {
    changed += a.sourceLinkAnnotationId
      ? await resyncBaseMapLinkPlacementsService({ cloneId: a.id, dispatch })
      : await resyncBaseMapLinkPlacementsService({
          sourceLinkId: a.id,
          dispatch,
        });
  }
  return changed;
}
