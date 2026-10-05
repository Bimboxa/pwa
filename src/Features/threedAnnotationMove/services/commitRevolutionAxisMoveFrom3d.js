import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import moveRevolutionAxisCenterService from "Features/revolutionAxes/services/moveRevolutionAxisCenterService";

// Write-back of a 3D move of a REVOLUTION_AXIS: the move only acts on where
// the axis sits relative to its ORIGIN (plan) base map
// (moveRevolutionAxisCenterService — elevation placements untouched, vertical
// base maps re-posed): its centre on the plan and, like any other annotation
// dropped on a real snap, its altitude (offsetZ).
//
// deltaLocal: {x, y, z} in the plan base map's LOCAL metre frame (y up; z =
// the vertical component of a snapped drop, 0 for a free one) — see
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

  await moveRevolutionAxisCenterService({
    axisId,
    deltaNormalized: {
      x: deltaLocal.x / meterByPx / imageWidth,
      y: -deltaLocal.y / meterByPx / imageHeight,
    },
    deltaOffsetZ: deltaLocal.z || 0,
    dispatch,
  });
  // Refresh the snap index with the moved geometry.
  dispatch(bumpSnapIndexEpoch());
}
