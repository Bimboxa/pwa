import { Vector3 } from "three";

import {
  getMatrixRelativeTo,
  getSurfacePieceDisplayFactor,
  getSurfaceTrianglesSurfaceM2,
} from "Features/threedFaceCut/services/resolveSurfaceFaceParts";

// Vertices closer than this (root frame, meters) are the same vertex: the
// extruded geometries are mostly non-indexed, each triangle owns its corners.
const WELD_STEP = 1e-4;

const triCountOf = (mesh) => {
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position) return 0;
  const index = mesh.geometry.getIndex();
  return Math.floor((index ? index.count : position.count) / 3);
};

// Triangles of the displayed annotation object `root` (overlays left out) —
// compared with a face region's own count to tell whether that face is the
// whole annotation.
export function countDisplayedTriangles(root) {
  let total = 0;
  root?.traverse?.((child) => {
    if (!child.isMesh || child.userData?.isHoverOverlay) return;
    total += triCountOf(child);
  });
  return total;
}

// Perimeter (m, root frame) of the triangle subset `tris` of `mesh`: the
// edges carried by ONE triangle of the subset (outer contour + holes).
function getTrianglesPerimeterM(mesh, tris, root) {
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.getIndex();
  const count = triCountOf(mesh);
  const matrix = getMatrixRelativeTo(mesh, root);
  const at = (t, k) => (index ? index.getX(3 * t + k) : 3 * t + k);

  const weldIdByKey = new Map();
  const points = [];
  const weld = (vertexIndex) => {
    const p = new Vector3()
      .fromBufferAttribute(position, vertexIndex)
      .applyMatrix4(matrix);
    const key = `${Math.round(p.x / WELD_STEP)}_${Math.round(
      p.y / WELD_STEP
    )}_${Math.round(p.z / WELD_STEP)}`;
    let id = weldIdByKey.get(key);
    if (id === undefined) {
      id = points.length;
      points.push(p);
      weldIdByKey.set(key, id);
    }
    return id;
  };

  const edges = new Map(); // "a_b" (a < b) → { a, b, count }
  for (const t of tris) {
    if (!(t >= 0 && t < count)) continue;
    const ids = [weld(at(t, 0)), weld(at(t, 1)), weld(at(t, 2))];
    for (let k = 0; k < 3; k++) {
      const a = ids[k];
      const b = ids[(k + 1) % 3];
      if (a === b) continue;
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const edge = edges.get(key);
      if (edge) edge.count += 1;
      else edges.set(key, { a, b, count: 1 });
    }
  }

  let total = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1) total += points[edge.a].distanceTo(points[edge.b]);
  }
  return total;
}

// Quantities of ONE face of a displayed annotation — the triangle region the
// hover stipples (getFaceRegion): { surface (m²), perimeter (m) | null }.
//
// perimeter is null when the triangulation cannot give it:
// - a CSG-carved mesh (userData.hasSubtraction): the boolean cuts leave
//   T-junctions, inner edges would count as contour;
// - a revolution half-view: the displayed contour is not the real one (the
//   surface is scaled back to the full turn).
export default function getFaceRegionQties(mesh, tris, root) {
  if (!mesh?.geometry?.getAttribute?.("position") || !tris?.length) return null;
  const factor = getSurfacePieceDisplayFactor(mesh);
  const surface = getSurfaceTrianglesSurfaceM2(mesh, tris, root) * factor;
  const perimeter =
    factor !== 1 || mesh.userData?.hasSubtraction
      ? null
      : getTrianglesPerimeterM(mesh, tris, root);
  return { surface, perimeter };
}
