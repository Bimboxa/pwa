import { ShapeUtils, Vector2 } from "three";

import { length, normalize } from "../../threedMesh/utils/vec3Utils.js";

import {
  computeFaceBasis,
  getFaceNewellNormal,
  getPolygonNormal,
  isCurvedFace,
  projectPoint,
} from "./meshPaintGeometry.js";

// Triangulation of a painted face (LocalFace) for its single-sided overlay:
// every triangle is wound CCW about `normal` (its FRONT face looks toward the
// painted side) and every vertex is lifted by `lift` meters along `normal`
// (z-fight with the host face). A curved face is triangulated facet by
// facet, each about its own normal.
//
// Pure (three.js math only, no scene): node-testable.

// Consecutive duplicates (and the closing duplicate) break earcut.
function cleanLoop(loop, basis) {
  const out = [];
  for (const p of loop || []) {
    const [x, y] = projectPoint(p, basis);
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.uv.x - x) < 1e-9 &&
      Math.abs(last.uv.y - y) < 1e-9
    )
      continue;
    out.push({ p, uv: new Vector2(x, y) });
  }
  while (out.length > 1) {
    const first = out[0].uv;
    const last = out[out.length - 1].uv;
    if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9)
      out.pop();
    else break;
  }
  return out.length >= 3 ? out : null;
}

/**
 * @param {{polygons: [{contour, holes}], normal}} localFace
 * @param {{lift?: number}} [options]
 * @returns {{positions: Float32Array, normals: Float32Array}} non-indexed
 *   triangles (9 floats per triangle), flat normals.
 */
export default function triangulatePaintFace(localFace, { lift = 0 } = {}) {
  const curved = isCurvedFace(localFace);
  let shared = localFace?.normal ? normalize(localFace.normal) : null;
  if (!shared || length(shared) === 0) shared = getFaceNewellNormal(localFace);
  if (!shared && !curved)
    return { positions: new Float32Array(0), normals: new Float32Array(0) };

  const positions = [];
  const normals = [];
  for (const polygon of localFace.polygons || []) {
    const origin = polygon?.contour?.[0];
    if (!origin) continue;
    // Curved surface: every facet has its own plane.
    const n = curved ? getPolygonNormal(polygon) : shared;
    if (!n) continue;
    const basis = computeFaceBasis(n, origin);
    const contour = cleanLoop(polygon.contour, basis);
    if (!contour) continue;
    const holes = (polygon.holes || [])
      .map((hole) => cleanLoop(hole, basis))
      .filter(Boolean);

    // The basis is right-handed with n: CCW about n = positive 2D area.
    if (ShapeUtils.isClockWise(contour.map((v) => v.uv))) contour.reverse();
    for (const hole of holes) {
      if (!ShapeUtils.isClockWise(hole.map((v) => v.uv))) hole.reverse();
    }

    const vertices = [contour, ...holes].flat();
    const faces = ShapeUtils.triangulateShape(
      contour.map((v) => v.uv),
      holes.map((hole) => hole.map((v) => v.uv))
    );
    for (const [i0, i1, i2] of faces) {
      const a = vertices[i0];
      let b = vertices[i1];
      let c = vertices[i2];
      if (!a || !b || !c) continue;
      const area2 =
        (b.uv.x - a.uv.x) * (c.uv.y - a.uv.y) -
        (c.uv.x - a.uv.x) * (b.uv.y - a.uv.y);
      if (area2 === 0) continue;
      if (area2 < 0) [b, c] = [c, b];
      for (const v of [a, b, c]) {
        positions.push(
          v.p.x + n.x * lift,
          v.p.y + n.y * lift,
          v.p.z + n.z * lift
        );
        normals.push(n.x, n.y, n.z);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}
