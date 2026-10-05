import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

// Write-back of a 3D move of a REVOLUTION_AXIS: the move only acts on where
// the axis sits on its ORIGIN (plan) base map — the centre point row in
// db.points. Same write as the 2D centre drag (MainMapEditorV3):
// - in-plane only: the vertical component is ignored (offsetZ untouched);
// - the placements on the elevations are NOT touched (the axis keeps its
//   position in each elevation image) — the resync then re-poses those
//   vertical base maps so their plane still contains the moved axis.
//
// deltaLocal: {x, y} in the plan base map's LOCAL metre frame (y up) — see
// commitAnnotationsTransformFrom3d for the local ↔ pixel mapping.
export default async function commitRevolutionAxisMoveFrom3d({
  editor,
  axisId,
  baseMapId,
  deltaLocal,
  dispatch,
}) {
  const baseMap = editor?.sceneManager?.imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getBaseMapForRender(baseMap);
  if (!metrics) {
    console.warn("[threedAnnotationMove] no base map metrics for", baseMapId);
    return;
  }
  const { imageWidth, imageHeight, meterByPx } = metrics;
  if (!imageWidth || !imageHeight || !meterByPx) return;

  const axis = await db.annotations.get(axisId);
  const pointId = axis?.point?.id;
  const point = pointId ? await db.points.get(pointId) : null;
  if (!axis || axis.deletedAt || !point) return;

  await db.points.update(point.id, {
    x: point.x + deltaLocal.x / meterByPx / imageWidth,
    y: point.y - deltaLocal.y / meterByPx / imageHeight,
  });

  await resyncRevolutionAxisPlacementsService({ axisId, dispatch });

  dispatch(triggerAnnotationsUpdate());
  dispatch(bumpSnapIndexEpoch());
}
