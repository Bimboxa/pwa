import { nanoid } from "@reduxjs/toolkit";
import { Vector3 } from "three";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import buildFaceAnnotationFields from "Features/threedDrawing/utils/buildFaceAnnotationFields";
import pickHostBaseMap from "Features/threedDrawing/utils/pickHostBaseMap";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import buildFlatMesh3d from "../utils/buildFlatMesh3d";
import { buildMesh3dStorage } from "./writeMesh3dService";

// A closed contour drawn in 3D that has no plan encoding (commitDrawnFace
// returned NO_2D_ENCODING, e.g. an L-shaped contour on a wall, or a vertical
// face with an apex that has no corner below it): a new annotation holding a
// one-face mesh (a flat sheet, pulled into a solid with the extrude tool).
// Every contour that HAS a plan encoding stays a regular annotation.
//
// draftProps: the armed newAnnotation — a template draft (the sheet keeps
// the template + `listingId`, like commitDrawnFace), or the template-less
// draft of the "Dessin" tool (the sheet belongs to the base map + `scopeId`
// only). vertices: drawn world points [{x, y, z, baseMapId?}]. Returns the
// created annotation, or null.
export default async function createFlatMesh3dAnnotationService({
  editor,
  vertices,
  baseMaps,
  projectId,
  scopeId,
  listingId = null,
  draftProps,
  layerId,
  createAnnotationFn,
}) {
  const isTemplateless =
    Boolean(draftProps?.isTemplateless) && !draftProps?.annotationTemplateId;
  if (!isTemplateless && !draftProps?.annotationTemplateId) return null;

  const carriedIds = new Set(vertices.map((v) => v.baseMapId).filter(Boolean));
  let host = null;
  if (carriedIds.size === 1) {
    const id = carriedIds.values().next().value;
    host = baseMaps.find((b) => b.id === id) ?? null;
  }
  if (!host) host = pickHostBaseMap(vertices, baseMaps);
  const sceneManager = editor?.sceneManager;
  const group = host ? sceneManager?.imagesManager?.getGroup?.(host.id) : null;
  const metrics = getBaseMapForRender(host);
  if (!host || !group || !metrics) return null;

  group.updateWorldMatrix(true, false);
  const toLocal = (p) => {
    const local = group.worldToLocal(new Vector3(p.x, p.y, p.z));
    return { x: local.x, y: local.y, z: local.z };
  };
  const local = vertices.map(toLocal);
  // Face the side the user is looking from.
  const eye = sceneManager.camera
    ? toLocal(sceneManager.camera.position)
    : null;
  const hint = eye
    ? { x: eye.x - local[0].x, y: eye.y - local[0].y, z: eye.z - local[0].z }
    : null;
  const mesh = buildFlatMesh3d(local, hint);
  if (!mesh) return null;

  const storage = buildMesh3dStorage({
    mesh,
    baseOffsetZ: 0,
    metrics,
    baseMapId: host.id,
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
    baseMapId: host.id,
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
  };

  await withoutUndo(() => db.points.bulkAdd(pointRows));
  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}
