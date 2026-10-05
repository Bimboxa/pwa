import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

// Moves a REVOLUTION_AXIS on its ORIGIN (plan) base map: the move only acts
// on the centre point row in db.points — the same write as the 2D centre
// drag (MainMapEditorV3). The placements on the elevations are NOT touched
// (the axis keeps its position in each elevation image); the resync then
// re-poses those vertical base maps so their plane still contains the axis.
//
// deltaNormalized: {x, y} in the plan base map's normalized frame ([0..1] of
// the reference image size — the unit of db.points).
// Returns true when the axis was moved.
export default async function moveRevolutionAxisCenterService({
  axisId,
  deltaNormalized,
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
  await resyncRevolutionAxisPlacementsService({ axisId, dispatch });
  dispatch?.(triggerAnnotationsUpdate());
  return true;
}
