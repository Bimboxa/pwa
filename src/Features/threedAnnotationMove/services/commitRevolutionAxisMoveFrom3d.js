import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import moveRevolutionAxisCenterService from "Features/revolutionAxes/services/moveRevolutionAxisCenterService";

// Write-back of a 3D move of a REVOLUTION_AXIS: the move only acts on where
// the axis sits on its ORIGIN (plan) base map (moveRevolutionAxisCenterService
// — elevation placements untouched, vertical base maps re-posed). In-plane
// only: the vertical component is ignored (offsetZ untouched).
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

  await moveRevolutionAxisCenterService({
    axisId,
    deltaNormalized: {
      x: deltaLocal.x / meterByPx / imageWidth,
      y: -deltaLocal.y / meterByPx / imageHeight,
    },
    dispatch,
  });
  // Refresh the snap index with the moved geometry.
  dispatch(bumpSnapIndexEpoch());
}
