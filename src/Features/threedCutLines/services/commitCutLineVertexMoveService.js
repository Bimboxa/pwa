import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import encodeCutLineRefs from "../utils/encodeCutLineRefs";

// Patch of a CUT_LINE row once the vertex at `index` is dropped at `world`
// (useCutLineVertexHandlers): the vertex gets a NEW db.points row (a point
// of a cut line is never shared — it is forked rather than moved, so the
// drag can never pull another annotation's vertex), the whole line is
// re-encoded (offsetZ = lowest vertex, per-ref offsetBottom) since the moved
// vertex may now be the lowest, and a dragged `derived` point becomes a
// user-placed one (solid segments). Pure apart from the projection.
//
// Returns { pointRow, patch: { points, offsetZ } } or null (projection off
// the base map). `resolvedPoints`: the row's resolved px points (the render
// list, with ids) — they give the plan position of the other vertices.
export function computeCutLineVertexMovePatch({
  row,
  resolvedPoints,
  index,
  world,
  baseMap,
}) {
  if (!row?.points?.[index] || !baseMap) return null;
  const moved = worldToBaseMapNormalized(world, baseMap);
  if (!moved) return null;
  const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const offsetZ = row.offsetZ || 0;
  const projected = row.points.map((ref, i) => {
    if (i === index) {
      return { x: moved.x, y: moved.y, offset: moved.offset, stop: ref.stop };
    }
    const px = resolvedPoints?.find((p) => p?.id === ref.id);
    const x = px ? px.x / imageSize.width : null;
    const y = px ? px.y / imageSize.height : null;
    return {
      x,
      y,
      offset: offsetZ + (ref.offsetBottom || 0),
      derived: ref.derived,
      stop: ref.stop,
    };
  });
  if (projected.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return null;
  }

  const encoded = encodeCutLineRefs(projected);
  const newId = nanoid();
  const pointRow = {
    id: newId,
    x: moved.x,
    y: moved.y,
    projectId: row.projectId,
    baseMapId: row.baseMapId,
  };
  const points = encoded.points.map((p, i) => ({
    ...row.points[i],
    id: i === index ? newId : row.points[i].id,
    offsetBottom: p.offsetBottom,
    ...(i === index ? { derived: undefined } : {}),
  }));
  // `derived: undefined` would be persisted as a key: strip it.
  points.forEach((p) => {
    if (p.derived === undefined) delete p.derived;
  });
  return { pointRow, patch: { points, offsetZ: encoded.offsetZ } };
}

// One undo step: the new point row + the re-encoded refs.
export default async function commitCutLineVertexMoveService({
  annotationId,
  pointRow,
  patch,
}) {
  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      await db.points.add(pointRow);
      await db.annotations.update(annotationId, patch);
    });
  });
}
