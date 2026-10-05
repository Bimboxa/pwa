import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import BaseMap from "Features/baseMaps/js/BaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";
import baseMapWorldToLocal from "Features/baseMaps/js/baseMapWorldToLocal";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import { roundOffsetZ } from "Features/annotationMesh3d/utils/mesh3dFrame";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

// Reverse of resyncRevolutionAxisPlacementsService: a VERTICAL base map that
// hosts a REVOLUTION_AXIS_PLACEMENT was moved / rotated by the user (base map
// move tools), so the plan axis — the source of truth of that pose — is
// rewritten to match: centre point (db.points), altitude (offsetZ) and
// diameter direction (directionDeg). Without this, the plan axis stays behind
// and the next axis-driven resync snaps the base map back.
//
// The placement keeps its position in the elevation image, so the new axis
// centre is simply the world position of the placement point. The other
// elevations hosting the same axis are then re-posed by the regular resync
// (the moved one already matches and is skipped by its EPS guard).
//
// Only ever called from user gesture commits — never from the resync or an
// effect — so the two directions cannot loop.
const EPS = 1e-9;
const EPS_DEG = 1e-6;

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

// Signed difference a − b wrapped to [-180, 180).
const deltaDeg = (a, b) => ((((a - b + 180) % 360) + 360) % 360) - 180;

/**
 * @param {Object} params
 * @param {string} params.baseMapId   the base map whose pose was just written
 * @param {Function} [params.dispatch] redux dispatch
 * @returns {Promise<number>} how many axes were updated
 */
export default async function syncRevolutionAxesFromVerticalBaseMapService({
  baseMapId,
  dispatch,
} = {}) {
  if (!baseMapId) return 0;

  try {
    const elevationRecord = await db.baseMaps.get(baseMapId);
    if (!elevationRecord || elevationRecord.deletedAt) return 0;
    if (getBaseMapTransform(elevationRecord).orientation !== "VERTICAL")
      return 0;

    const placements = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter(
        (a) =>
          !a.deletedAt &&
          a.type === "REVOLUTION_AXIS_PLACEMENT" &&
          a.revolutionAxisId &&
          a.point?.id
      )
      .toArray();
    if (placements.length === 0) return 0;

    const elevationBaseMap = await hydrate(elevationRecord);
    const elevationTransform = getBaseMapTransform(elevationBaseMap);
    const angleRad = ((elevationTransform.angleDeg || 0) * Math.PI) / 180;

    const updatedAxisIds = new Set();

    for (const placement of placements) {
      const axisId = placement.revolutionAxisId;
      if (updatedAxisIds.has(axisId)) continue;

      const axis = await db.annotations.get(axisId);
      // An axis of the previous model has no centre point: nothing to move.
      if (
        !axis ||
        axis.deletedAt ||
        axis.type !== "REVOLUTION_AXIS" ||
        !axis.point?.id
      )
        continue;

      const [axisPoint, clickPoint] = await db.points.bulkGet([
        axis.point.id,
        placement.point.id,
      ]);
      if (!axisPoint || !clickPoint) continue;

      const planBaseMap = await hydrate(await db.baseMaps.get(axis.baseMapId));
      if (!planBaseMap) continue;
      const planTransform = getBaseMapTransform(planBaseMap);
      if (planTransform.orientation === "VERTICAL") continue;

      // --- new axis centre: world position of the placement point ---

      const A = baseMapNormalizedToWorld(
        { x: clickPoint.x, y: clickPoint.y },
        elevationBaseMap
      );
      if (!A) continue;
      const centerNorm = worldToBaseMapNormalized(A, planBaseMap);
      if (!centerNorm) continue;

      // --- new diameter direction: the elevation's local +X, read in the plan
      // LOCAL METRE frame (y up, CCW) — inverse of the solver's probe ---

      const lA = baseMapWorldToLocal(A, planTransform);
      const lB = baseMapWorldToLocal(
        { x: A.x + Math.cos(angleRad), y: A.y, z: A.z - Math.sin(angleRad) },
        planTransform
      );
      const thetaDeg =
        (Math.atan2(lB.y - lA.y, lB.x - lA.x) * 180) / Math.PI -
        (axis.invertHalf ? 180 : 0);
      const prevDirectionDeg = Number(axis.directionDeg) || 0;
      // Keep the stored value's winding: only apply the actual rotation.
      const dDirection = deltaDeg(thetaDeg, prevDirectionDeg);

      const offsetZ = roundOffsetZ(A.y);

      // --- write (only what moved) ---

      const pointMoved =
        Math.abs(centerNorm.x - axisPoint.x) > EPS ||
        Math.abs(centerNorm.y - axisPoint.y) > EPS;
      const annotationUpdates = {};
      if (Math.abs(offsetZ - (Number(axis.offsetZ) || 0)) > EPS)
        annotationUpdates.offsetZ = offsetZ;
      if (Math.abs(dDirection) > EPS_DEG)
        annotationUpdates.directionDeg = prevDirectionDeg + dDirection;
      const annotationChanged = Object.keys(annotationUpdates).length > 0;

      if (!pointMoved && !annotationChanged) continue;

      if (pointMoved)
        await db.points.update(axisPoint.id, {
          x: centerNorm.x,
          y: centerNorm.y,
        });
      if (annotationChanged)
        await db.annotations.update(axis.id, annotationUpdates);

      updatedAxisIds.add(axisId);
    }

    // The other elevations hosting these axes follow.
    for (const axisId of updatedAxisIds) {
      await resyncRevolutionAxisPlacementsService({ axisId, dispatch });
    }

    if (updatedAxisIds.size > 0) dispatch?.(triggerAnnotationsUpdate());
    return updatedAxisIds.size;
  } catch (err) {
    console.error("[revolutionAxes] axis sync from base map failed", err);
    return 0;
  }
}
