import db from "App/db/db";
import getAnnotationRingsWorld from "Features/threedDrawing/utils/getAnnotationRingsWorld";

import {
  commitCutLineRebuild,
  computeCutLineRebuild,
} from "./rebuildCutLineService";

// « Recalculer le prolongement » (ToolbarEditCutLine): the cut line is
// rebuilt from its DRAWN points (the non-`derived` refs) on the current
// scene (rebuildCutLineService). `annotation`: the RESOLVED row (px points)
// from the renderer's list; `editor`: the active 3D editor; `baseMap`: the
// host base map row. One undo step. Returns { derivedStart, derivedEnd } or
// null.
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
  const drawn = [];
  const oldDerived = [];
  raw.points.forEach((ref, i) => {
    const w = worldPoints[i];
    if (ref.derived)
      oldDerived.push({ x: w.x, y: w.y, z: w.z, stop: ref.stop });
    else drawn.push({ x: w.x, y: w.y, z: w.z, ref });
  });

  const result = computeCutLineRebuild({
    raw,
    drawn,
    baseMap,
    editor,
    oldDerived,
  });
  if (!result) return null;
  await commitCutLineRebuild({
    annotationId: raw.id,
    pointRows: result.pointRows,
    patch: result.patch,
  });
  return { derivedStart: result.derivedStart, derivedEnd: result.derivedEnd };
}
