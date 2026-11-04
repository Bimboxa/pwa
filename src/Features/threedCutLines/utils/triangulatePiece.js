import { ShapeUtils, Vector2 } from "three";

import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";

// Triangle soup (9 numbers per triangle, world coordinates) of a planar
// piece { contour, holes, normal } (clipFaceByCutLines / clipRegionByCutLines
// output): the polygon is triangulated in its plane basis (earcut via
// ShapeUtils, holes kept) and lifted back. Empty when the piece is
// degenerate. three.js' ShapeUtils is pure math, so this stays importable
// from node tests.
export default function triangulatePiece(piece) {
  if (!piece?.contour || piece.contour.length < 3 || !piece.normal) return [];
  const basis = computePlaneBasis(piece.normal, piece.contour[0]);
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
    return [];
  }
  if (!tris?.length) return [];
  const flat2d = [...contour2d, ...holes2d.flat()];
  const positions = [];
  for (const [i0, i1, i2] of tris) {
    for (const i of [i0, i1, i2]) {
      const p = liftPointTo3d({ x: flat2d[i].x, y: flat2d[i].y }, basis);
      positions.push(p.x, p.y, p.z);
    }
  }
  return positions;
}
