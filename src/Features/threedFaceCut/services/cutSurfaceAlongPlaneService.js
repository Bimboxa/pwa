import { nanoid } from "@reduxjs/toolkit";
import { Quaternion, Vector3 } from "three";

import db from "App/db/db";

import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import isSurfaceCutHost from "../utils/isSurfaceCutHost";
import { localToSurfaceCut } from "../utils/surfaceCutsFrame";

// « Découpe horizontale / verticale » of a SURFACE host (lathe, shell, swept
// profile — isSurfaceCutHost): the cut plane previewed by
// FaceCutAxisOverlayThreed is appended to annotation.surfaceCuts, in the
// base map's frame (stored like a painted part: x, y normalized, z absolute
// local meters — see surfaceCutsFrame). The host keeps its 2D definition;
// the 3D build replays the cuts (applySurfaceCuts) and the displayed solid
// comes back in pieces.
//
// One annotation row update = one undo step (Ctrl+Z removes the cut).
//
// Result: { kind: "SURFACE", annotationId } | { kind: "NONE", reason }
// (NOT_EDITABLE: not a surface host any more; NO_BASE_MAP: its base map is
// not in the scene) — same shape as cutFaceAlongPathService for the toaster.

export default async function cutSurfaceAlongPlaneService({
  editor,
  annotationId,
  axis,
  plane,
  seed,
  updateAnnotationFn,
}) {
  if (!annotationId || !plane?.normal || !seed) {
    return { kind: "NONE", reason: "NO_ANNOTATION" };
  }
  const annotation = await db.annotations.get(annotationId);
  if (!annotation || !isSurfaceCutHost(annotation)) {
    return { kind: "NONE", reason: "NOT_EDITABLE" };
  }

  const imagesManager = editor?.sceneManager?.imagesManager;
  const group = imagesManager?.getGroup?.(annotation.baseMapId);
  const baseMap = imagesManager?.baseMapsMap?.[annotation.baseMapId];
  const metrics = baseMap ? getBaseMapForRender(baseMap) : null;
  if (!group || !metrics) return { kind: "NONE", reason: "NO_BASE_MAP" };

  // World → base-map-local: points through the group's inverse world
  // matrix, the normal through its inverse rotation (unit stays unit).
  group.updateWorldMatrix(true, false);
  const qInv = group.getWorldQuaternion(new Quaternion()).invert();
  const toLocal = (p) => {
    const v = group.worldToLocal(new Vector3(p.x, p.y, p.z));
    return { x: v.x, y: v.y, z: v.z };
  };
  const n = new Vector3(plane.normal.x, plane.normal.y, plane.normal.z);
  const offset = n.dot(new Vector3(seed.x, seed.y, seed.z)) - plane.constant;
  const pointOnPlaneWorld = {
    x: seed.x - n.x * offset,
    y: seed.y - n.y * offset,
    z: seed.z - n.z * offset,
  };
  const normalLocal = n.clone().applyQuaternion(qInv).normalize();
  const pointLocal = toLocal(pointOnPlaneWorld);
  const seedLocal = toLocal(seed);

  const cut = localToSurfaceCut(
    {
      id: nanoid(),
      axis,
      plane: {
        normal: { x: normalLocal.x, y: normalLocal.y, z: normalLocal.z },
        constant:
          normalLocal.x * pointLocal.x +
          normalLocal.y * pointLocal.y +
          normalLocal.z * pointLocal.z,
      },
      seed: seedLocal,
    },
    metrics
  );
  if (!cut) return { kind: "NONE", reason: "NOT_EDITABLE" };

  await updateAnnotationFn({
    id: annotationId,
    surfaceCuts: [...(annotation.surfaceCuts ?? []), cut],
  });
  return { kind: "SURFACE", annotationId };
}
