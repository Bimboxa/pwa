import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { clearItemPartSelection } from "Features/selection/selectionSlice";
import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import {
  buildMesh3dResetPatch,
  getMesh3dSourcePoints,
} from "../utils/mesh3dSource";

// Two normalized positions closer than this are the same point — same slack
// as the 3D drawing commits (insertOrReusePoints).
const POINT_REUSE_EPS = 5e-4;

const isNear = (p, q) =>
  Math.abs(p.x - q.x) < POINT_REUSE_EPS &&
  Math.abs(p.y - q.y) < POINT_REUSE_EPS;

// Reverts an annotation converted to a mesh to its original 2D geometry (the
// `mesh3dSource` snapshot taken at conversion): type, points, holes, height,
// offset… The mesh and every edit made on it are dropped.
//
// Each original point is resolved to a db.points row: the very same row when
// it still sits where it was (the welds with the neighbor annotations come
// back), else a live point of the base map at that position, else a new row.
//
// One undo step (the annotation row) brings the mesh back.
// Returns { ok: true } | { ok: false, reason: "NO_SOURCE" }.
export default async function resetMesh3dAnnotationService({
  annotationId,
  dispatch,
}) {
  const annotation = await db.annotations.get(annotationId);
  const source = annotation?.mesh3dSource;
  if (!annotation?.isMesh3d || !source?.points?.length) {
    return { ok: false, reason: "NO_SOURCE" };
  }

  const livePoints = (
    await db.points.where("baseMapId").equals(annotation.baseMapId).toArray()
  ).filter((p) => !p.deletedAt);
  const liveById = new Map(livePoints.map((p) => [p.id, p]));

  const idByOldId = new Map();
  const newRows = [];
  for (const ref of getMesh3dSourcePoints(source)) {
    if (!ref?.id || idByOldId.has(ref.id)) continue;
    // No coordinates in the snapshot (the row was already missing at
    // conversion): nothing better than the original reference.
    if (!Number.isFinite(ref.x) || !Number.isFinite(ref.y)) continue;

    const original = liveById.get(ref.id);
    if (original && isNear(original, ref)) continue; // still in place
    const neighbor = livePoints.find((p) => isNear(p, ref));
    if (neighbor) {
      idByOldId.set(ref.id, neighbor.id);
      continue;
    }
    const row = {
      id: nanoid(),
      x: ref.x,
      y: ref.y,
      projectId: annotation.projectId,
      baseMapId: annotation.baseMapId,
      ...(annotation.listingId ? { listingId: annotation.listingId } : {}),
    };
    newRows.push(row);
    livePoints.push(row);
    idByOldId.set(ref.id, row.id);
  }

  const patch = buildMesh3dResetPatch(source, idByOldId);

  if (newRows.length) await withoutUndo(() => db.points.bulkAdd(newRows));
  await db.annotations.update(annotationId, patch);

  dispatch?.(triggerAnnotationsUpdate());
  dispatch?.(bumpSnapIndexEpoch());
  dispatch?.(clearItemPartSelection(annotationId));
  return { ok: true };
}
