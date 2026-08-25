import db from "App/db/db";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import BaseMap from "Features/baseMaps/js/BaseMap";
import computeVerticalBaseMapPlacementFromAxis from "Features/baseMaps/js/computeVerticalBaseMapPlacementFromAxis";

// Single writer of the 3D pose of every VERTICAL base map that hosts a
// REVOLUTION_AXIS_PLACEMENT.
//
// The plan axis is the source of truth: dropping it on an elevation (or moving
// the axis afterwards) re-poses that elevation so its plane contains the axis,
// with the ORANGE half-disc behind it. Everything downstream — the 3D groups
// (useApplyBaseMapTransformsIn3d), the camera-side half-view tracking, the
// annotations resolved on that base map — reacts to `triggerBaseMapsUpdate`.
//
// This service ONLY ever writes VERTICAL base maps, and only when the pose
// actually moved (EPS guard below). That is what keeps it from looping:
//   - useApplyBaseMapTransformsIn3d only READS db.baseMaps,
//   - useAnnotationsV2 re-runs on baseMapsUpdatedAt but (since the revolution
//     resolution stopped reading base map poses) cannot write anything back,
//   - a second run finds no delta and writes nothing, so even an accidental
//     effect-driven call converges instead of oscillating.
const EPS = 1e-6;

const sameNumber = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < EPS;

const samePlacement = (record, next) =>
  sameNumber(record?.angleDeg, next.angleDeg) &&
  sameNumber(record?.position?.x, next.position.x) &&
  sameNumber(record?.position?.y, next.position.y) &&
  sameNumber(record?.position?.z, next.position.z);

// Dexie records are plain objects; the solver needs the BaseMap getters
// (getImageSize / getMeterByPx resolve the versioned reference frame).
const hydrate = async (record) => {
  if (!record) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(record.id)
    .toArray();
  return BaseMap.createFromRecord(
    record,
    (versions ?? []).filter((v) => !v.deletedAt)
  );
};

/**
 * Re-pose the vertical base maps driven by a revolution axis.
 *
 * @param {Object} params
 * @param {string} [params.axisId]       re-pose every placement of this axis
 * @param {string} [params.placementId]  re-pose just this placement
 * @param {string} [params.planBaseMapId] re-pose every placement of every axis
 *                                        hosted by this plan base map
 * @param {Function} [params.dispatch]   redux dispatch (to notify 3D)
 * @returns {Promise<number>} how many base maps actually changed
 */
export default async function resyncRevolutionAxisPlacementsService({
  axisId,
  placementId,
  planBaseMapId,
  dispatch,
} = {}) {
  // --- resolve the placements to re-pose ---

  let placements = [];
  if (placementId) {
    const one = await db.annotations.get(placementId);
    if (one && !one.deletedAt) placements = [one];
  } else {
    const axisIds = [];
    if (axisId) {
      axisIds.push(axisId);
    } else if (planBaseMapId) {
      const axes = await db.annotations
        .where("baseMapId")
        .equals(planBaseMapId)
        .filter((a) => !a.deletedAt && a.type === "REVOLUTION_AXIS")
        .toArray();
      axisIds.push(...axes.map((a) => a.id));
    }
    if (axisIds.length === 0) return 0;

    const all = await db.annotations
      .filter(
        (a) =>
          !a.deletedAt &&
          a.type === "REVOLUTION_AXIS_PLACEMENT" &&
          axisIds.includes(a.revolutionAxisId)
      )
      .toArray();
    placements = all;
  }

  if (placements.length === 0) return 0;

  // --- solve + write ---

  const axisCache = new Map();
  const baseMapCache = new Map();
  const getBaseMap = async (id) => {
    if (!id) return null;
    if (!baseMapCache.has(id))
      baseMapCache.set(id, await hydrate(await db.baseMaps.get(id)));
    return baseMapCache.get(id);
  };

  let changed = 0;

  for (const placement of placements) {
    const aId = placement.revolutionAxisId;
    if (!aId || !placement.point?.id || !placement.baseMapId) continue;

    if (!axisCache.has(aId)) axisCache.set(aId, await db.annotations.get(aId));
    const axis = axisCache.get(aId);
    // An axis of the previous model has no centre point: nothing to solve from.
    if (!axis || axis.deletedAt || !axis.point?.id) continue;

    const [axisPoint, clickPoint] = await db.points.bulkGet([
      axis.point.id,
      placement.point.id,
    ]);
    if (!axisPoint || !clickPoint) continue;

    const planBaseMap = await getBaseMap(axis.baseMapId);
    const elevationBaseMap = await getBaseMap(placement.baseMapId);
    if (!planBaseMap || !elevationBaseMap) continue;

    const next = computeVerticalBaseMapPlacementFromAxis({
      axis: {
        centerNorm: { x: axisPoint.x, y: axisPoint.y },
        directionDeg: axis.directionDeg,
        invertHalf: axis.invertHalf,
        offsetZ: axis.offsetZ,
      },
      planBaseMap,
      elevationBaseMap,
      clickNorm: { x: clickPoint.x, y: clickPoint.y },
    });
    if (!next) continue;

    const record = await db.baseMaps.get(placement.baseMapId);
    if (samePlacement(record, next)) continue;

    await db.baseMaps.update(placement.baseMapId, {
      angleDeg: next.angleDeg,
      position: next.position,
      // Provenance, so the two-target "Localiser le fond de plan" solver can
      // warn before overwriting an axis-driven pose (both write these fields).
      poseSource: "REVOLUTION_AXIS",
      poseSourceAnnotationId: axis.id,
    });
    changed += 1;
  }

  if (changed > 0 && dispatch) dispatch(triggerBaseMapsUpdate());
  return changed;
}
