import { nanoid } from "@reduxjs/toolkit";
import { Matrix4, Vector3 } from "three";

import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { clearItemPartSelection } from "Features/selection/selectionSlice";

import { localToNormalized } from "Features/annotationMesh3d/utils/mesh3dFrame";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import { SURFACE_CUT_REMOVE } from "../utils/surfaceCutsFrame";

// Deletes pieces of a cut surface host (lathe, shell… partitioned by
// applySurfaceCuts): each piece becomes a REMOVE entry of
// annotation.surfaceCuts — a point on the piece (the centroid of its largest
// triangle, base map frame) and its area — and the 3D build drops the piece
// holding that point (applySurfaceCutsToSoups). The host keeps its 2D
// definition; the quantities subtract the removed areas.
//
// One annotation row update = one undo step. The part selection is cleared
// (the pieces are renumbered by the rebuild).
//
// Returns { ok: true, count } | { ok: false, reason: "NOT_FOUND" }.
export default async function removeSurfacePiecesService({
  editor,
  annotationId,
  pieceIndices,
  dispatch,
}) {
  const wanted = new Set(pieceIndices || []);
  if (!annotationId || !wanted.size) return { ok: false, reason: "NOT_FOUND" };
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return { ok: false, reason: "NOT_FOUND" };

  const sceneManager = editor?.sceneManager;
  const root =
    sceneManager?.annotationsManager?.annotationsObjectsMap?.[annotationId];
  const imagesManager = sceneManager?.imagesManager;
  const group = imagesManager?.getGroup?.(annotation.baseMapId);
  const baseMap = imagesManager?.baseMapsMap?.[annotation.baseMapId];
  const metrics = baseMap ? getBaseMapForRender(baseMap) : null;
  if (!root || !group || !metrics) return { ok: false, reason: "NOT_FOUND" };

  group.updateWorldMatrix(true, false);
  const groupInverse = new Matrix4().copy(group.matrixWorld).invert();
  const entries = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh || !wanted.has(mesh.userData?.surfaceCutPiece)) return;
    const position = mesh.geometry?.getAttribute?.("position");
    if (!position) return;
    mesh.updateWorldMatrix(true, false);
    const toLocal = new Matrix4().multiplyMatrices(
      groupInverse,
      mesh.matrixWorld
    );
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const ab = new Vector3();
    const ac = new Vector3();
    let best = null;
    let bestArea = -1;
    let surface = 0;
    for (let i = 0; i + 2 < count; i += 3) {
      const at = (k) => (index ? index.getX(i + k) : i + k);
      a.fromBufferAttribute(position, at(0)).applyMatrix4(toLocal);
      b.fromBufferAttribute(position, at(1)).applyMatrix4(toLocal);
      c.fromBufferAttribute(position, at(2)).applyMatrix4(toLocal);
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      surface += area;
      if (area > bestArea) {
        bestArea = area;
        best = new Vector3()
          .addVectors(a, b)
          .add(c)
          .multiplyScalar(1 / 3);
      }
    }
    if (!best) return;
    const stored = Number.isFinite(mesh.userData?.surfaceCutPieceSurface)
      ? mesh.userData.surfaceCutPieceSurface
      : surface;
    entries.push({
      id: nanoid(),
      kind: SURFACE_CUT_REMOVE,
      point: localToNormalized(best, metrics),
      surface: Math.round(stored * 1e4) / 1e4,
    });
  });
  if (!entries.length) return { ok: false, reason: "NOT_FOUND" };

  await db.annotations.update(annotationId, {
    surfaceCuts: [...(annotation.surfaceCuts ?? []), ...entries],
  });
  dispatch?.(clearItemPartSelection(annotationId));
  dispatch?.(triggerAnnotationsUpdate());
  return { ok: true, count: entries.length };
}
