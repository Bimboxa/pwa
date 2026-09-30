import { nanoid } from "@reduxjs/toolkit";
import { Box3, Vector3 } from "three";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import createAnnotationService from "Features/annotations/services/createAnnotationService";
import buildFaceAnnotationFields from "Features/threedDrawing/utils/buildFaceAnnotationFields";
import pickHostBaseMap from "Features/threedDrawing/utils/pickHostBaseMap";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import buildFlatMesh3d from "../utils/buildFlatMesh3d";
import splitMesh3dFace from "../utils/splitMesh3dFace";
import getEditableMesh3d, { worldToMesh3dLocal } from "./getEditableMesh3d";
import writeMesh3dService, { buildMesh3dStorage } from "./writeMesh3dService";

// Slack (m) of the "the path lies within this annotation" bounding-box test.
const BOX_TOL_M = 5e-3;

// Annotations that may carry the drawn path: the ones the snaps pointed at
// first, then every visible MESH annotation whose bounding box contains the
// whole path (snaps on in-progress points or on a plan carry no annotation
// id). Regular annotations are only candidates when a snap designated them:
// drawing near one must never convert it behind the user's back.
function getCandidateAnnotationIds(editor, vertices) {
  const ids = [];
  const add = (id) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  vertices.forEach((v) => add(v.nodeId));

  const objectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  const box = new Box3();
  const point = new Vector3();
  for (const [id, object] of Object.entries(objectsMap)) {
    if (ids.includes(id) || !object?.userData?.isAnnotationMesh3d) continue;
    if (!isObjectChainVisible(object)) continue;
    box.setFromObject(object).expandByScalar(BOX_TOL_M);
    if (box.isEmpty()) continue;
    if (vertices.every((v) => box.containsPoint(point.set(v.x, v.y, v.z)))) {
      add(id);
    }
  }
  return ids;
}

// A closed contour drawn away from any annotation face: a new template-less
// annotation holding a one-face mesh (a flat sheet, pulled into a solid with
// the extrude tool).
async function createFlatMesh3dAnnotation({
  editor,
  vertices,
  baseMaps,
  projectId,
  scopeId,
  draftProps,
  layerId,
  createAnnotationFn,
}) {
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
    listingId: null,
  });
  if (!storage) return null;
  const { pointRows, mesh3d, offsetZ, points, cuts } = storage;

  const fields = buildFaceAnnotationFields({
    classifiedShape: "POLYGON",
    classificationFields: { type: "POLYGON", offsetZ, height: 0 },
    templateProps: draftProps,
  });
  const now = new Date().toISOString();
  const annotation = {
    id: nanoid(),
    projectId,
    scopeId: scopeId ?? null,
    listingId: null,
    baseMapId: host.id,
    ...(layerId ? { layerId } : {}),
    createdAt: now,
    updatedAt: now,
    ...fields,
    isTemplateless: true,
    isMesh3d: true,
    mesh3d,
    points,
    cuts,
  };

  await withoutUndo(() => db.points.bulkAdd(pointRows));
  const create = createAnnotationFn ?? createAnnotationService;
  return await create(annotation);
}

// Commit of a path drawn with the "Dessin" tool in the 3D editor.
//
// - the path lies on a face of an annotation and cuts it (boundary to
//   boundary, or a closed loop inside): that face is split. The annotation
//   stays ONE annotation — a regular one is converted to a mesh on the spot;
// - else a closed contour becomes a new flat mesh annotation.
//
// vertices: drawn world points [{x, y, z, nodeId?, baseMapId?, snapKind?}].
// Returns { kind: "SPLIT" | "CREATE", annotation } or null when the path
// commits nothing yet (keep drawing).
export default async function commitDrawnMesh3dPathService({
  editor,
  vertices,
  closed = false,
  baseMaps,
  projectId,
  scopeId,
  draftProps,
  layerId = null,
  createAnnotationFn = null,
  dispatch,
}) {
  if (!editor || !vertices || vertices.length < 2) return null;

  for (const annotationId of getCandidateAnnotationIds(editor, vertices)) {
    const ctx = await getEditableMesh3d({ editor, annotationId });
    if (!ctx) continue;
    const mesh = splitMesh3dFace(
      ctx.mesh,
      vertices.map((v) => worldToMesh3dLocal(v, ctx)),
      { closed }
    );
    if (!mesh) continue;
    const annotation = await writeMesh3dService({
      annotation: ctx.annotation,
      mesh,
      baseOffsetZ: ctx.baseOffsetZ,
      metrics: ctx.metrics,
      dispatch,
    });
    if (annotation) return { kind: "SPLIT", annotation };
  }

  // A contour snapped on a face that did not split it is a mistake, not a
  // new sheet floating on that face.
  if (!closed || vertices.length < 3) return null;
  if (vertices.some((v) => v.snapKind === "FACE")) return null;

  const annotation = await createFlatMesh3dAnnotation({
    editor,
    vertices,
    baseMaps: baseMaps || [],
    projectId,
    scopeId,
    draftProps,
    layerId,
    createAnnotationFn,
  });
  return annotation ? { kind: "CREATE", annotation } : null;
}
