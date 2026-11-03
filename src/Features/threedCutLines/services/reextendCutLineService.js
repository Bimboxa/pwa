import { nanoid } from "@reduxjs/toolkit";
import { Vector3 } from "three";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import getAnnotationRingsWorld from "Features/threedDrawing/utils/getAnnotationRingsWorld";

import collectSceneTriangles from "../js/collectSceneTriangles";
import encodeCutLineRefs from "../utils/encodeCutLineRefs";
import extendCutLine from "../utils/extendCutLine";

// « Recalculer le prolongement » (ToolbarEditCutLine): the extension of a
// cut line is run again from its DRAWN points (the non-`derived` refs) on
// the current scene; the derived points are replaced (their rows are left
// to the soft-delete of the points table: `db.points.update({deletedAt})`
// is not needed — the refs simply drop them), the drawn refs keep their ids
// and flags. The faces the drawn ends lie on are re-detected from the scene
// soup: the plane under each end is the plane of the nearest triangle
// containing the end point (within 5 mm), else that end is not extended.
//
// `annotation`: the RESOLVED row (px points) from the renderer's list;
// `editor`: the active 3D editor; `baseMap`: the host base map row.
// One undo step.
export default async function reextendCutLineService({
  annotation,
  editor,
  baseMap,
}) {
  if (!annotation?.id || !editor?.sceneManager || !baseMap) return null;
  const raw = await db.annotations.get(annotation.id);
  if (!raw?.points?.length) return null;

  const rings = getAnnotationRingsWorld(annotation, baseMap);
  const worldPoints = rings?.[0]?.ring;
  if (!worldPoints || worldPoints.length !== raw.points.length) {
    console.warn("[threedCutLines] re-extension aborted: points mismatch");
    return null;
  }
  const drawnIdx = raw.points
    .map((ref, i) => (ref.derived ? -1 : i))
    .filter((i) => i >= 0);
  if (drawnIdx.length < 2) return null;
  const drawn = drawnIdx.map((i) => ({
    x: worldPoints[i].x,
    y: worldPoints[i].y,
    z: worldPoints[i].z,
  }));

  const triangles = collectSceneTriangles(editor.sceneManager);
  const faceAt = (p) => findFaceNormalAt(triangles, p);
  const extended = extendCutLine({
    drawn,
    startFace: faceAt(drawn[0]),
    endFace: faceAt(drawn[drawn.length - 1]),
    triangles,
  });
  const { points, derivedStart, derivedEnd } = extended;

  const projected = points.map((p, i) => {
    const proj = worldToBaseMapNormalized(p, baseMap);
    if (!proj) return null;
    const derived = i < derivedStart || i >= points.length - derivedEnd;
    if (derived) return { ...proj, derived: true };
    const ref = raw.points[drawnIdx[i - derivedStart]];
    return ref?.stop ? { ...proj, stop: true } : proj;
  });
  if (projected.some((p) => !p)) return null;
  const encoded = encodeCutLineRefs(projected);

  const newRows = [];
  const refs = encoded.points.map((p, i) => {
    const derived = i < derivedStart || i >= points.length - derivedEnd;
    if (!derived) {
      const ref = raw.points[drawnIdx[i - derivedStart]];
      return { ...ref, offsetBottom: p.offsetBottom };
    }
    const id = nanoid();
    newRows.push({
      id,
      x: p.x,
      y: p.y,
      projectId: raw.projectId,
      baseMapId: raw.baseMapId,
    });
    return { id, offsetBottom: p.offsetBottom, derived: true };
  });

  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      if (newRows.length) await db.points.bulkAdd(newRows);
      await db.annotations.update(raw.id, {
        points: refs,
        offsetZ: encoded.offsetZ,
      });
    });
  });
  // The renderer rebuilds its entry from the live query.
  return { derivedStart, derivedEnd };
}

// Normal of the nearest triangle whose plane holds `p` (within 5 mm) and
// whose projection contains it, else null.
function findFaceNormalAt(triangles, p) {
  const P = new Vector3(p.x, p.y, p.z);
  let best = null;
  for (const t of triangles) {
    const n = new Vector3(t.n.x, t.n.y, t.n.z);
    const a = new Vector3(t.a.x, t.a.y, t.a.z);
    const d = Math.abs(n.dot(P.clone().sub(a)));
    if (d > 5e-3) continue;
    if (!pointInTriangle(P, t)) continue;
    if (!best || d < best.d) best = { d, normal: { x: n.x, y: n.y, z: n.z } };
  }
  return best ? { normal: best.normal } : null;
}

function pointInTriangle(P, t) {
  const a = new Vector3(t.a.x, t.a.y, t.a.z);
  const b = new Vector3(t.b.x, t.b.y, t.b.z);
  const c = new Vector3(t.c.x, t.c.y, t.c.z);
  const v0 = c.clone().sub(a);
  const v1 = b.clone().sub(a);
  const v2 = P.clone().sub(a);
  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-14) return false;
  const u = (d11 * d20 - d01 * d21) / denom;
  const v = (d00 * d21 - d01 * d20) / denom;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6;
}
