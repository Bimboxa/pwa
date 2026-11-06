import { Vector3 } from "three";

import baseMapWorldToLocal from "Features/baseMaps/js/baseMapWorldToLocal";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import resolveHostBaseMap from "Features/threedDrawing/utils/resolveHostBaseMap";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import buildFlatMesh3d from "../utils/buildFlatMesh3d";
import createMesh3dAnnotationFromLocalMeshService from "./createMesh3dAnnotationFromLocalMeshService";

// A closed contour drawn in 3D that has no plan encoding (commitDrawnFace
// returned NO_2D_ENCODING, e.g. an L-shaped contour on a wall, or a vertical
// face with an apex that has no corner below it): a new annotation holding a
// one-face mesh (a flat sheet, pulled into a solid with the extrude tool).
// Every contour that HAS a plan encoding stays a regular annotation.
//
// draftProps: the armed newAnnotation — a template draft (the sheet keeps
// the template + `listingId`, like commitDrawnFace), or the template-less
// draft of the "Dessin" tool (the sheet belongs to the base map + `scopeId`
// only). vertices: drawn world points [{x, y, z, baseMapId?}].
// preferredBaseMapId: the base map selected in 2D, host of the sheet when
// the vertices carry none (resolveHostBaseMap). `editor` is optional: without
// the live scene (the clone flow in the 2D editor) the vertices are expressed
// in the host's local frame from its stored pose, and the face is not
// oriented toward a camera. Returns the created annotation, or null.
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
  preferredBaseMapId = null,
}) {
  const isTemplateless =
    Boolean(draftProps?.isTemplateless) && !draftProps?.annotationTemplateId;
  if (!isTemplateless && !draftProps?.annotationTemplateId) return null;

  const host = resolveHostBaseMap({ vertices, baseMaps, preferredBaseMapId });
  const sceneManager = editor?.sceneManager;
  const group = host ? sceneManager?.imagesManager?.getGroup?.(host.id) : null;
  const metrics = getBaseMapForRender(host);
  if (!host || !metrics) return null;

  let toLocal;
  if (group) {
    group.updateWorldMatrix(true, false);
    toLocal = (p) => {
      const local = group.worldToLocal(new Vector3(p.x, p.y, p.z));
      return { x: local.x, y: local.y, z: local.z };
    };
  } else {
    const transform = getBaseMapTransform(host);
    toLocal = (p) => {
      const local = baseMapWorldToLocal(p, transform);
      return { x: local.x, y: local.y, z: local.z };
    };
  }
  const local = vertices.map(toLocal);
  // Face the side the user is looking from.
  const eye = sceneManager?.camera
    ? toLocal(sceneManager.camera.position)
    : null;
  const hint = eye
    ? { x: eye.x - local[0].x, y: eye.y - local[0].y, z: eye.z - local[0].z }
    : null;
  const mesh = buildFlatMesh3d(local, hint);
  if (!mesh) return null;

  return await createMesh3dAnnotationFromLocalMeshService({
    mesh,
    baseMapId: host.id,
    metrics,
    projectId,
    scopeId,
    listingId,
    draftProps,
    layerId,
    createAnnotationFn,
  });
}
