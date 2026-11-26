import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getTemplatelessDraft } from "Features/mapEditor/utils/startTemplatelessDraw";
import localScanRuntime from "Features/localScans/services/localScanRuntime";
import {
  getLocalScanViews,
  isLocalScanViewDisplayed,
} from "Features/localScans/services/localScanViewRegistry";
import { getLocalScanWorldMatrix } from "Features/localScans/utils/getLocalScanMatrixInBaseMap";
import isLocalScanResource from "Features/localScans/utils/isLocalScanResource";

import buildVectorizedSectionRows from "../utils/buildVectorizedSectionRows";

import vectorizeLocalScanSectionService from "./vectorizeLocalScanSectionService";

// Point clouds to cut: the ones displayed in the 3D scene (what the user
// sees cut), or — nothing displayed (« Affichage 3D : Masqué ») — the scans
// of the project's scan base maps, decoded through the shared runtime.
// → { clouds: [{data, matrixWorld}], release }
async function collectClouds(projectId) {
  const scene = getActiveThreedEditor()?.sceneManager?.scene;
  const displayed = getLocalScanViews()
    .filter(
      (view) => view.data?.positions && isLocalScanViewDisplayed(view, scene)
    )
    .map((view) => {
      view.root.updateWorldMatrix(true, false);
      return { data: view.data, matrixWorld: view.root.matrixWorld.clone() };
    });
  if (displayed.length) return { clouds: displayed, release: () => {} };

  const baseMaps = await db.baseMaps
    .where("projectId")
    .equals(projectId)
    .toArray();
  // one base map per scan resource: they all carry the same cloud
  const carrierByResourceId = new Map();
  baseMaps.forEach((baseMap) => {
    const resourceId = baseMap.localScan?.resourceId;
    if (!resourceId || baseMap.deletedAt || !baseMap.localScan.matrix) return;
    if (!carrierByResourceId.has(resourceId))
      carrierByResourceId.set(resourceId, baseMap);
  });
  const handles = [];
  const clouds = [];
  for (const [resourceId, carrier] of carrierByResourceId) {
    const resource = await db.resources.get(resourceId);
    if (!isLocalScanResource(resource)) continue;
    const handle = localScanRuntime.acquire(resource);
    handles.push(handle);
    try {
      const { data } = await handle.promise;
      clouds.push({ data, matrixWorld: getLocalScanWorldMatrix(carrier) });
    } catch (error) {
      // file missing on this device: this scan is skipped
      console.warn("[baseMapClipping] scan not available", error);
    }
  }
  return { clouds, release: () => handles.forEach((h) => h.release()) };
}

// « Vectoriser la coupe » of a base map: the point clouds are cut by the
// base map plane (the points within ± toleranceM of it — what the plane
// "prints"), the footprint is vectorized (vectorizeSliceFootprint) and
// written on the base map as templateless POLYLINE annotations.
//
// One undo step: every row is built in memory, then written in a single
// transaction, with a single annotations update dispatch.
//
// baseMap: BaseMap instance (image size, scale, pose).
// Returns { status, annotationCount, pointCount }, status:
//   "OK" | "NO_SCALE" | "NO_CLOUD" | "NO_POINT" | "NO_LINE".
export default async function vectorizeBaseMapSectionService({
  baseMap,
  toleranceM,
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

  const { clouds, release } = await collectClouds(baseMap.projectId);
  let vectorized;
  try {
    if (!clouds.length) return { ...result, status: "NO_CLOUD" };
    vectorized = await vectorizeLocalScanSectionService({
      clouds,
      page,
      toleranceM,
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
