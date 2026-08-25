import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import applyWrapperTransformToPoints from "Features/mapEditor/utils/applyWrapperTransformToPoints";
import computeWrapperBbox from "Features/mapEditor/utils/computeWrapperBbox";
import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

// Write-back of a 3D annotation move/rotate into the 2D storage: the new
// point positions land in db.points (normalized) through the same machinery
// as the 2D wrapper (commitWrapperTransform — shared-external points forked,
// single transaction), so the annotation is fully up to date in its 2D
// environment; quantities are derived at read time (getAnnotationQties in
// useAnnotationsV2), nothing else to recompute.
//
// The transform arrives in the base map's LOCAL metre frame (the frame the
// 3D annotation objects are built in). Local (metres, y-up) ↔ pixel (y-down)
// mapping, from pixelToWorld: x_l = (x_px − W/2)·m, y_l = −(y_px − H/2)·m.
// Hence the Y flips below, and — the mirror reversing orientation — a local
// rotation of phi about +Z is a pixel-space rotation of −phi.
//
// transform:
//   { kind: "MOVE", deltaLocal: {x, y} }              (local metres)
//   { kind: "ROTATE", pivotLocal: {x, y}, phi }       (rad, about local +Z)
//
// Known 2D-move parity: POLYGON meshLines (stored in absolute normalized
// coords) are not translated — the 2D wrapper move leaves them behind too.
export default async function commitAnnotationsTransformFrom3d({
  editor,
  annotationIds,
  baseMapId,
  transform,
  allAnnotations,
  projectId,
  dispatch,
}) {
  const baseMap = editor?.sceneManager?.imagesManager?.baseMapsMap?.[baseMapId];
  const metrics = getBaseMapForRender(baseMap);
  if (!metrics) {
    console.warn("[threedAnnotationMove] no base map metrics for", baseMapId);
    return;
  }
  const { imageWidth, imageHeight, meterByPx } = metrics;
  const imageSize = { width: imageWidth, height: imageHeight };

  const carried = (allAnnotations ?? []).filter((a) =>
    annotationIds.includes(a.id)
  );
  if (!carried.length) return;

  let pointUpdates;
  let moveDelta = null;
  let clearRotation = false;

  if (transform.kind === "MOVE") {
    moveDelta = {
      x: transform.deltaLocal.x / meterByPx,
      y: -transform.deltaLocal.y / meterByPx,
    };
    pointUpdates = applyWrapperTransformToPoints({
      annotations: carried,
      wrapperBbox: computeWrapperBbox(carried),
      deltaPos: moveDelta,
      partType: "MOVE",
    });
  } else if (transform.kind === "ROTATE") {
    const theta2dDeg = (-transform.phi * 180) / Math.PI;
    const pivotPx = {
      x: imageWidth / 2 + transform.pivotLocal.x / meterByPx,
      y: imageHeight / 2 - transform.pivotLocal.y / meterByPx,
    };
    // The ROTATE branch rotates around the wrapperBbox CENTER: a degenerate
    // zero-size bbox centered on the pivot makes it rotate around the pivot.
    pointUpdates = applyWrapperTransformToPoints({
      annotations: carried,
      wrapperBbox: { x: pivotPx.x, y: pivotPx.y, width: 0, height: 0 },
      deltaPos: { x: theta2dDeg, y: 0 },
      partType: "ROTATE",
    });
    // An arbitrary user-picked pivot breaks the single-center model of
    // rotation/rotationCenter — bake the rotation into the points and reset
    // the metadata (same rule as vertex edits and RESIZE).
    clearRotation = true;
  } else {
    return;
  }

  if (!pointUpdates?.size) return;

  await commitWrapperTransform({
    selectedAnnotationIds: annotationIds,
    allAnnotations,
    pointUpdates,
    imageSize,
    rotationDelta: null,
    wrapperBbox: null,
    moveDelta,
    clearRotation,
  });

  // Openings glued on the moved walls follow their host — same as the 2D
  // wrapper commit.
  try {
    await reflowOpeningsForHost({
      hostIds: annotationIds,
      movedPointIds: [],
      projectId,
      imageSize,
      meterByPx,
    });
  } catch (err) {
    console.error("[threedAnnotationMove] openings reflow failed", err);
  }

  dispatch(triggerAnnotationsUpdate());
  // Refresh the snap index with the moved geometry so the next grab snaps at
  // the new location.
  dispatch(bumpSnapIndexEpoch());
}
