import { dot, sub } from "./vec3.js";

// Planes of the scene faces holding `p` (within `tolerance` m, inside the
// triangle), one per distinct normal, nearest first: [{ point, normal }].
// A point on a slab gives one plane, a point at the foot of a wall two.
//
//   triangles = [{ a, b, c, n }] world triangles of the scene (unit n)
export default function findFacePlanesAt(triangles, p, tolerance = 5e-3) {
  const found = [];
  for (const t of triangles) {
    const d = Math.abs(dot(t.n, sub(p, t.a)));
    if (d > tolerance) continue;
    if (!pointInTriangle(p, t)) continue;
    if (found.some((f) => Math.abs(dot(f.n, t.n)) > 0.999)) continue;
    found.push({ d, n: t.n, point: t.a });
  }
  found.sort((u, v) => u.d - v.d);
  return found.map((f) => ({
    point: { x: f.point.x, y: f.point.y, z: f.point.z },
    normal: { x: f.n.x, y: f.n.y, z: f.n.z },
  }));
}

// Face a cut line end starts its extension on, read from the scene soup: the
// nearest face holding `p` (within 5 mm). Returns { normal } or null.
export function findFaceNormalAt(triangles, p) {
  const planes = findFacePlanesAt(triangles, p);
  return planes.length ? { normal: planes[0].normal } : null;
}

// Face a cut line end starts its extension on when the end direction is
// known: among the faces holding `p`, the one the end segment LIES on (the
// smallest |direction · normal|), the nearest on a tie. At the foot of a wall
// a line drawn down the wall gets the wall, not the slab under its end
// point. Returns { normal } or null.
export function findFaceNormalAlong(triangles, p, direction) {
  const planes = findFacePlanesAt(triangles, p);
  if (!planes.length) return null;
  const len = direction ? Math.sqrt(dot(direction, direction)) : 0;
  if (len < 1e-12) return { normal: planes[0].normal };
  let best = null;
  for (const plane of planes) {
    const across = Math.abs(dot(direction, plane.normal)) / len;
    if (!best || across < best.across - 1e-6) best = { across, plane };
  }
  return { normal: best.plane.normal };
}

// A point within this distance (m) outside an edge still belongs to the
// triangle: an end placed on the boundary of a face comes back a few µm off
// after the round trip through the stored coordinates.
const EDGE_MARGIN_M = 1e-3;

function pointInTriangle(p, t) {
  const v0 = sub(t.c, t.a);
  const v1 = sub(t.b, t.a);
  const v2 = sub(p, t.a);
  const d00 = dot(v0, v0);
  const d01 = dot(v0, v1);
  const d11 = dot(v1, v1);
  const d20 = dot(v2, v0);
  const d21 = dot(v2, v1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-14) return false;
  const u = (d11 * d20 - d01 * d21) / denom;
  const v = (d00 * d21 - d01 * d20) / denom;
  // Barycentric coordinate × height over the opposite edge = distance to
  // that edge (in the triangle's plane).
  const twiceArea = Math.sqrt(denom);
  const v2c = sub(t.c, t.b);
  const hu = twiceArea / Math.sqrt(d11);
  const hv = twiceArea / Math.sqrt(d00);
  const hw = twiceArea / Math.sqrt(dot(v2c, v2c));
  return (
    u * hu >= -EDGE_MARGIN_M &&
    v * hv >= -EDGE_MARGIN_M &&
    (1 - u - v) * hw >= -EDGE_MARGIN_M
  );
}
