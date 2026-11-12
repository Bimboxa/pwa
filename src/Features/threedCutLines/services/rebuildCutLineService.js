import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";
import getBaseMapNormalWorldFromRow from "Features/baseMaps/js/getBaseMapNormalWorldFromRow";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import collectSceneTriangles from "../js/collectSceneTriangles";
import encodeCutLineRefs from "../utils/encodeCutLineRefs";
import extendCutLine from "../utils/extendCutLine";
import findFacePlanesAt, { findFaceNormalAt } from "../utils/findFacePlanesAt";

// A « Stop » set on a derived point survives a rebuild when the new
// extension passes within this distance (m) of it.
const STOP_KEEP_TOL_M = 1e-2;

// Rebuild of a cut line from its DRAWN points on the current scene: the
// extension is run again (extendCutLine), the derived points are replaced
// by new rows (the old ones are simply dropped from the refs), the drawn
// refs keep their ids and flags, and the whole line is re-encoded
// (encodeCutLineRefs). Shared by the vertex drag (useCutLineVertexHandlers —
// the dropped vertex is a drawn point with a fresh row) and « Recalculer le
// prolongement » (reextendCutLineService).
//
//   - raw: the DB row; baseMap: its host base map row; editor: the 3D editor;
//   - drawn: [{ x, y, z, ref, newRow? }] world points in line order, `ref`
//     the ref to keep (its id, `stop`), `newRow: { x?, y? }` set when the
//     point needs a NEW db.points row (a dropped vertex);
//   - oldDerived: [{ x, y, z, stop }] the previous derived points (their
//     stops are re-applied to the new derived points nearby).
//
// The faces the drawn ends lie on are re-detected from the scene soup: the
// nearest triangle holding the end point (within 5 mm), else that end is
// not extended.
//
// Returns { pointRows, patch: { points, offsetZ }, derivedStart, derivedEnd }
// or null (projection failure, fewer than 2 drawn points).
export function computeCutLineRebuild({
  raw,
  drawn,
  baseMap,
  editor,
  oldDerived = [],
}) {
  if (!raw || !baseMap || !editor?.sceneManager) return null;
  if (!drawn || drawn.length < 2) return null;

  const drawnPoints = drawn.map((d) => ({ x: d.x, y: d.y, z: d.z }));
  const triangles = collectSceneTriangles(editor.sceneManager);
  const faceAt = (p) => findFaceNormalAt(triangles, p);
  const { points, derivedStart, derivedEnd } = extendCutLine({
    drawn: drawnPoints,
    startFace: faceAt(drawnPoints[0]),
    endFace: faceAt(drawnPoints[drawnPoints.length - 1]),
    triangles,
    upNormal: getBaseMapNormalWorldFromRow(baseMap),
  });
  const isDerived = (i) => i < derivedStart || i >= points.length - derivedEnd;
  const keptStops = oldDerived.filter((p) => p?.stop);

  const projected = points.map((p, i) => {
    const proj = worldToBaseMapNormalized(p, baseMap);
    if (!proj) return null;
    if (isDerived(i)) {
      const stop = keptStops.some(
        (s) => Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) <= STOP_KEEP_TOL_M
      );
      return { ...proj, derived: true, ...(stop ? { stop: true } : {}) };
    }
    const ref = drawn[i - derivedStart].ref;
    return ref?.stop ? { ...proj, stop: true } : proj;
  });
  if (projected.some((p) => !p)) return null;
  const encoded = encodeCutLineRefs(projected);

  const pointRows = [];
  const refs = encoded.points.map((p, i) => {
    if (!isDerived(i)) {
      const d = drawn[i - derivedStart];
      const ref = { ...(d.ref || {}), offsetBottom: p.offsetBottom };
      delete ref.derived;
      if (d.newRow) {
        ref.id = nanoid();
        pointRows.push({
          id: ref.id,
          x: p.x,
          y: p.y,
          projectId: raw.projectId,
          baseMapId: raw.baseMapId,
        });
      }
      return ref;
    }
    const id = nanoid();
    pointRows.push({
      id,
      x: p.x,
      y: p.y,
      projectId: raw.projectId,
      baseMapId: raw.baseMapId,
    });
    return {
      id,
      offsetBottom: p.offsetBottom,
      derived: true,
      ...(p.stop ? { stop: true } : {}),
    };
  });

  return {
    pointRows,
    patch: { points: refs, offsetZ: encoded.offsetZ },
    derivedStart,
    derivedEnd,
  };
}

// One undo step: the new point rows + the re-encoded refs.
export async function commitCutLineRebuild({ annotationId, pointRows, patch }) {
  await withUndoGroup(async () => {
    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointRows.length) await db.points.bulkAdd(pointRows);
      await db.annotations.update(annotationId, patch);
    });
  });
}

// Kept as a named export of this service for the vertex drag
// (useCutLineVertexHandlers).
export { findFacePlanesAt };
