import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import buildFaceAnnotationFields from "Features/threedDrawing/utils/buildFaceAnnotationFields";

import { buildMesh3dStorage } from "./writeMesh3dService";

// A NEW annotation holding a mesh (`isMesh3d`), from a LOCAL mesh of its base
// map: the sheet of a contour drawn in 3D without plan encoding
// (createFlatMesh3dAnnotationService), the facet painted by the « Pinceau »
// (commitMeshBrushMeshService).
//
// mesh: LOCAL form ({vertices: [{x, y, z}], faces: [{loop, holes}]}, base-map
// -local meters, z absolute in the base map frame). metrics: {imageWidth,
// imageHeight, meterByPx} of that base map.
// draftProps: the armed newAnnotation — a template draft (the annotation
// keeps the template + `listingId`), or the template-less draft of the
// "Dessin" tool (base map + `scopeId` only).
// extraFields: spread last on the row (provenance markers…).
//
// Undo: the plan projection points are written outside the undo stack, so
// ONE undo step — the annotation row — removes the annotation.
//
// Returns the created annotation, or null.
export default async function createMesh3dAnnotationFromLocalMeshService({
  mesh,
  baseMapId,
  metrics,
  projectId,
  scopeId,
  listingId = null,
  draftProps,
  layerId,
  extraFields = null,
  createAnnotationFn,
}) {
  const isTemplateless =
    Boolean(draftProps?.isTemplateless) && !draftProps?.annotationTemplateId;
  if (!isTemplateless && !draftProps?.annotationTemplateId) return null;
  if (!mesh || !baseMapId || !metrics) return null;

  const storage = buildMesh3dStorage({
    mesh,
    baseOffsetZ: 0,
    metrics,
    baseMapId,
    projectId,
    listingId: isTemplateless ? null : listingId,
  });
  if (!storage) return null;
  const { pointRows, mesh3d, offsetZ, points, cuts, mesh3dPlanIsSegment } =
    storage;

  const fields = buildFaceAnnotationFields({
    classifiedShape: "POLYGON",
    classificationFields: { type: "POLYGON", offsetZ, height: 0 },
    templateProps: draftProps,
  });
  const now = new Date().toISOString();
  const annotation = {
    id: nanoid(),
    projectId,
    ...(isTemplateless
      ? { scopeId: scopeId ?? null, listingId: null, isTemplateless: true }
      : {
          listingId,
          annotationTemplateId: draftProps.annotationTemplateId,
        }),
    baseMapId,
    ...(layerId ? { layerId } : {}),
    createdAt: now,
    updatedAt: now,
    ...fields,
    isMesh3d: true,
    mesh3d,
    points,
    cuts,
    // Kept like the other buildMesh3dStorage callers: the 2D renderer draws
    // a segment projection as a 3 px line with a polyline hit area.
    mesh3dPlanIsSegment,
    ...(extraFields ?? {}),
  };

  await withoutUndo(() => db.points.bulkAdd(pointRows));
  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
