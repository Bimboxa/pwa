import { ShapeUtils, Vector2 } from "three";

import { buildStippleOverlayFromPositions } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "Features/threedMesh/utils/planeProjection";

// Hover stipple of ONE piece of a face cut by the cut lines
// (clipFaceByCutLines): the piece polygon triangulated in the face's plane
// basis (earcut via ShapeUtils, holes kept) and lifted back to world
// coordinates — the overlay is added to the scene root. Null when the piece
// is degenerate.
export default function buildPieceStippleOverlay(piece, basis) {
  if (!piece?.contour || piece.contour.length < 3 || !basis) return null;
  const to2d = (p) => {
    const q = projectPointTo2d(p, basis);
    return new Vector2(q.x, q.y);
  };
  const contour2d = piece.contour.map(to2d);
  const holes2d = (piece.holes || [])
    .filter((h) => h?.length >= 3)
    .map((h) => h.map(to2d));
  let tris;
  try {
    tris = ShapeUtils.triangulateShape(contour2d, holes2d);
  } catch {
    return null;
  }
  if (!tris?.length) return null;
  const flat2d = [...contour2d, ...holes2d.flat()];
  const positions = [];
  for (const [i0, i1, i2] of tris) {
    for (const i of [i0, i1, i2]) {
      const p = liftPointTo3d({ x: flat2d[i].x, y: flat2d[i].y }, basis);
      positions.push(p.x, p.y, p.z);
    }
  }
  return buildStippleOverlayFromPositions(positions);
}
