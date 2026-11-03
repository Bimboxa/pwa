import { dot, distanceSq, lerp, copy } from "./vec3.js";

// A vertex within EPS (world units, meters) of the plane is treated as lying
// ON it. Without this, a triangle with one vertex exactly on the plane and the
// other two straddling yields only ONE strict edge crossing and gets dropped —
// punching gaps in the contour wherever the plane grazes a vertex ring.
const EPS = 1e-5;

// Pure port of threedEditor/js/utilsClipping/computePlaneSectionSegments: the
// line segments where `plane` crosses each triangle.
//
//   plane     = { normal: {x,y,z}, constant }  with  dot(normal, p) === constant
//               for every point p on the plane.
//   triangles = [{ a, b, c, n }]  world-space corners + unit winding normal.
//
// Returns [{ a, b, normal, triIndex }]: one segment per straddling triangle,
// `normal` being that triangle's `n` and `triIndex` its index in the input.
// Coplanar triangles (3 corners on the plane) and mere touches (1 corner, or
// an edge lying on the plane with the third corner off it still yields 2
// points and is kept) are ignored.
export default function sectionTrianglesByPlane(plane, triangles) {
  const segments = [];
  if (!plane?.normal || !Array.isArray(triangles) || triangles.length === 0) {
    return segments;
  }
  const { normal } = plane;
  const constant = plane.constant ?? 0;

  for (let triIndex = 0; triIndex < triangles.length; triIndex++) {
    const tri = triangles[triIndex];
    if (!tri?.a || !tri?.b || !tri?.c) continue;
    const verts = [tri.a, tri.b, tri.c];
    const d = verts.map((v) => dot(normal, v) - constant);
    const side = d.map((v) => (v > EPS ? 1 : v < -EPS ? -1 : 0));

    if (side[0] > 0 && side[1] > 0 && side[2] > 0) continue;
    if (side[0] < 0 && side[1] < 0 && side[2] < 0) continue;

    const pts = [];
    const addPt = (p) => {
      if (!pts.some((q) => distanceSq(q, p) < EPS * EPS)) pts.push(p);
    };
    for (let i = 0; i < 3; i++) {
      if (side[i] === 0) addPt(copy(verts[i]));
    }
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (side[i] * side[j] < 0) {
        const t = d[i] / (d[i] - d[j]);
        addPt(lerp(verts[i], verts[j], t));
      }
    }

    if (pts.length !== 2) continue;
    const [a, b] = pts;
    if (distanceSq(a, b) <= EPS * EPS) continue;
    segments.push({ a, b, normal: tri.n ? copy(tri.n) : null, triIndex });
  }

  return segments;
}
