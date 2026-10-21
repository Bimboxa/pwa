import {
  add,
  dot,
  normalize,
  scale,
} from "../../threedMesh/utils/vec3Utils.js";

import { MIN_THICKNESS_M, WELD_PRECISION_M } from "./mesh3dConstants.js";
import { getLoopAreaVector, reverseFace } from "./mesh3dTopology.js";

// A polyline swept along a direction -> an open ribbon mesh, one quad per
// segment (the « Extruder » tool applied to a flat POLYLINE).
//
// points: [{x, y, z}] in local meters, in drawing order (open loop: the
//   closing duplicate of a closed polyline is dropped here).
// direction: unit vector, local frame. distance: signed sweep (m).
// closeLine: one more quad joins the last point back to the first.
// normalHint: optional vector the quads should face (the side the user looks
//   from) when the ribbon has no outside — an open polyline, or a closed one
//   swept within its own plane.
//
// Vertices: the base points, then their swept copies. Quad i is
// [i, i+1, n+i+1, n+i], so two adjacent quads run their shared edge in
// opposite directions — what buildEdgeMap / pushPullMesh3dFace rely on to
// find neighbors. A closed ring faces outward (its area vector decides).
// Returns null for a degenerate input (< 2 distinct points, zero direction,
// |distance| under the minimum thickness).
const sameVertex = (a, b) =>
  Math.abs(a.x - b.x) < WELD_PRECISION_M &&
  Math.abs(a.y - b.y) < WELD_PRECISION_M &&
  Math.abs(a.z - b.z) < WELD_PRECISION_M;

export default function buildRibbonMesh3d({
  points,
  direction,
  distance,
  closeLine = false,
  normalHint = null,
}) {
  if (!Number.isFinite(distance) || Math.abs(distance) < MIN_THICKNESS_M) {
    return null;
  }
  const dir = normalize(direction || { x: 0, y: 0, z: 0 });
  if (dir.x === 0 && dir.y === 0 && dir.z === 0) return null;

  const base = [];
  for (const p of points || []) {
    const last = base[base.length - 1];
    if (last && sameVertex(last, p)) continue;
    base.push({ x: p.x, y: p.y, z: p.z });
  }
  if (
    closeLine &&
    base.length > 1 &&
    sameVertex(base[0], base[base.length - 1])
  ) {
    base.pop();
  }
  const n = base.length;
  if (n < 2) return null;

  const offset = scale(dir, distance);
  const vertices = [...base, ...base.map((p) => add(p, offset))];
  const segmentCount = closeLine ? n : n - 1;
  let faces = [];
  for (let i = 0; i < segmentCount; i++) {
    const j = (i + 1) % n;
    faces.push({ loop: [i, j, n + j, n + i], holes: [] });
  }

  // Orientation. Quad i's normal is (p[j] − p[i]) × offset: for a ring that
  // is outward exactly when the sweep goes along the ring's area vector.
  let flip = null;
  if (closeLine && n >= 3) {
    const area = getLoopAreaVector(
      base,
      base.map((_, i) => i)
    );
    const s = dot(offset, area);
    if (Math.abs(s) > 1e-9) flip = s < 0;
  }
  if (flip === null && normalHint) {
    const sum = { x: 0, y: 0, z: 0 };
    for (const face of faces) {
      const a = getLoopAreaVector(vertices, face.loop);
      sum.x += a.x;
      sum.y += a.y;
      sum.z += a.z;
    }
    const s = dot(sum, normalHint);
    if (Math.abs(s) > 1e-9) flip = s < 0;
  }
  if (flip) faces = faces.map(reverseFace);

  return { vertices, faces };
}
