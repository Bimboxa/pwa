import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { roundOffsetZ } from "Features/annotationMesh3d/utils/mesh3dFrame";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

// Moves a REVOLUTION_AXIS relative to its ORIGIN (plan) base map: the move
// only acts on the centre point row in db.points — the same write as the 2D
// centre drag (MainMapEditorV3) — and, optionally, on its altitude (offsetZ,
// the absolute Z of the axis centre). The placements on the elevations are
// NOT touched (the axis keeps its position in each elevation image); the
// resync then re-poses those vertical base maps so their plane still contains
// the axis, at its new altitude.
//
// deltaNormalized: {x, y} in the plan base map's normalized frame ([0..1] of
// the reference image size — the unit of db.points).
// deltaOffsetZ: metres added to axis.offsetZ (3D move dropped on a snap).
// Returns true when the axis was moved.
export default async function moveRevolutionAxisCenterService({
  axisId,
  deltaNormalized,
  deltaOffsetZ = 0,
  dispatch,
}) {
  const dx = Number(deltaNormalized?.x);
  const dy = Number(deltaNormalized?.y);
  if (!axisId || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;

  const axis = await db.annotations.get(axisId);
  const pointId = axis?.point?.id;
  const point = pointId ? await db.points.get(pointId) : null;
  if (!axis || axis.deletedAt || axis.type !== "REVOLUTION_AXIS" || !point)
    return false;

  await db.points.update(point.id, { x: point.x + dx, y: point.y + dy });
  const dz = Number(deltaOffsetZ) || 0;
  if (Math.abs(dz) > 1e-9) {
    await db.annotations.update(axis.id, {
      // 0.1 mm: a snapped drop carries float noise the toolbar would show.
      offsetZ: roundOffsetZ((Number(axis.offsetZ) || 0) + dz),
    });
  }
  await resyncRevolutionAxisPlacementsService({ axisId, dispatch });
  dispatch?.(triggerAnnotationsUpdate());
  return true;
}
