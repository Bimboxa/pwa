import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";

import buildVectorizedSectionRows from "../utils/buildVectorizedSectionRows";

import collectSectionCloudsService from "./collectSectionCloudsService";
import vectorizeLocalScanSectionService from "./vectorizeLocalScanSectionService";

// « Vectoriser » of a base map: the point clouds are cut to a layer of the
// base map (`range`: signed distances to its plane — the layer of its
// clipping box seen from the camera, getVisibleClipLayerRange), the
// footprint is vectorized (vectorizeSliceFootprint) and written on the base
// map as templateless POLYLINE annotations.
//
// One undo step: every row is built in memory, then written in a single
// transaction, with a single annotations update dispatch.
//
// baseMap: BaseMap instance (image size, scale, pose).
// Returns { status, annotationCount, pointCount }, status:
//   "OK" | "NO_SCALE" | "NO_CLOUD" | "NO_POINT" | "NO_LINE".
export default async function vectorizeBaseMapSectionService({
  baseMap,
  range,
  scopeId,
  dispatch,
}) {
  const result = { status: "OK", annotationCount: 0, pointCount: 0 };
  const { width, height } = baseMap.getImageSize?.() ?? {};
  const meterByPx = baseMap.getMeterByPx?.();
  if (!(width > 0) || !(height > 0) || !(meterByPx > 0)) {
    return { ...result, status: "NO_SCALE" };
  }
  const page = { ...getBaseMapTransform(baseMap), width, height, meterByPx };

  const { clouds, release } = await collectSectionCloudsService(
    baseMap.projectId
  );
  let vectorized;
  try {
    if (!clouds.length) return { ...result, status: "NO_CLOUD" };
    vectorized = await vectorizeLocalScanSectionService({
      clouds,
      page,
      range,
    });
  } finally {
    release();
  }
  const { polylines } = vectorized;
  result.pointCount = vectorized.pointCount;
  if (!result.pointCount) return { ...result, status: "NO_POINT" };
  if (!polylines.length) return { ...result, status: "NO_LINE" };

  const { newPoints, newAnnotations } = buildVectorizedSectionRows({
    polylines,
    widthM: width * meterByPx,
    heightM: height * meterByPx,
    baseMapId: baseMap.id,
    projectId: baseMap.projectId,
    scopeId,
    annotationProps: getTemplatelessDraft("POLYLINE"),
    createId: nanoid,
  });
  if (!newAnnotations.length) return { ...result, status: "NO_LINE" };

  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      await db.points.bulkAdd(newPoints);
      await db.annotations.bulkAdd(newAnnotations);
    });
  });
  dispatch?.(triggerAnnotationsUpdate());
  result.annotationCount = newAnnotations.length;
  return result;
}
