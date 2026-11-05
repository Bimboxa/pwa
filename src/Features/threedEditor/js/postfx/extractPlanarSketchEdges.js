import coalesceCoplanarFaces from "Features/threedMesh/utils/coalesceCoplanarFaces.js";
import groupTrianglesByPlane, {
  toSoupTriangle,
} from "Features/threedMesh/utils/groupTrianglesByPlane.js";
import { dot, sub } from "Features/threedMesh/utils/vec3Utils.js";

// Feature-edge extraction for CSG-carved geometries (three-bvh-csg triangle
// soup). EdgesGeometry pairs triangles by exact edge endpoints, but boolean
// cuts leave T-junctions (a vertex of one triangle sits mid-edge of its
// neighbor): those interior edges have no detectable twin, so EdgesGeometry
// draws them as silhouette strokes slashing across flat faces.
//
// Instead, the triangles are grouped by plane (groupTrianglesByPlane: seeded
// by the best-conditioned triangles, never by a CSG sliver) and
// coalesceCoplanarFaces unions each coplanar cluster in 2D — T-junction seams
// dissolve, collinear interior vertices are cleaned up — leaving only the true
// outlines (contour + hole loops) of each planar face. This trades the
// EdgesGeometry dihedral-angle threshold for "all planar-face outlines", which
// is exactly right for carved extrusions (every real edge is a ~90° corner).
//
// Returns a flat [x1,y1,z1,x2,y2,z2, ...] segment-pair array in mesh-LOCAL
// coordinates (same contract as EdgesGeometry positions), or null when the
// geometry is unusable — callers then fall back to EdgesGeometry.

// Above this the per-triangle union cost is not worth it (CSG-carved
// annotation solids stay in the hundreds of triangles).
const MAX_TRIS = 20_000;

// Doubled area below which a triangle is degenerate (no normal, no face).
const MIN_TRIANGLE_AREA2 = 1e-12;

// Interval tolerances for the seam suppression, in mesh-local units. EPS_T
// absorbs float noise when matching collinear overlaps; kept pieces shorter
// than MIN_KEEP_T are quantization slivers, not real edges.
const EPS_T = 1e-3;
const MIN_KEEP_T = 2e-3;

// Two outline segments run along the same seam when both ends of the shorter
// one are this close (mesh-local units) to the line of the longer one. A
// distance, not an angle: it tightens by itself on long seams and stays
// meaningful on short ones, whose direction is mostly position noise.
const SAME_LINE_TOL = 1e-3;

const AXES = ["x", "y", "z"];

// Suppress the portions of face-outline segments that are shared with another
// face whose plane is within `thresholdDeg` (dihedral angle between facets).
// Such seams are construction artifacts (arc sampling, stairs subdivisions):
// two nearly-coplanar facets end up in different coalesced clusters, and the
// cluster outlines both trace their common boundary.
//
// The two copies of a seam are matched GEOMETRICALLY (SAME_LINE_TOL), never
// by a rounded line key: after a CSG carve they no longer share their end
// points (each face gets its own cut point, in float32), so their directions
// differ by noise — and a key breaks on every rounding boundary, the sign of a
// near-zero component included (the seams of a wall all run along local Z).
// Candidate pairs come from a sweep along the axis the segments overlap the
// least on; each segment then subtracts the intervals covered by segments of
// OTHER faces with dot(n1, n2) >= cos(threshold). Interval subtraction (not
// whole-segment matching) also handles partial overlaps: on a stair step only
// the shared upper portion of the seam dissolves, the step notch stays drawn.
// The dot is signed so a wall folding back on itself (~180°) keeps its edge.
function suppressLowDihedralSeams(segments, normals, thresholdDeg) {
  const cosT = Math.cos((thresholdDeg * Math.PI) / 180);

  const entries = [];
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  const extent = { x: 0, y: 0, z: 0 };
  for (const { a, b, faceIdx } of segments) {
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < 1e-9) continue;
    const entry = {
      a,
      b,
      faceIdx,
      len,
      dir: { x: d.x / len, y: d.y / len, z: d.z / len },
      min: {},
      max: {},
      // Kept intervals, as abscissas along `dir` from `a`.
      kept: [[0, len]],
    };
    for (const k of AXES) {
      entry.min[k] = Math.min(a[k], b[k]);
      entry.max[k] = Math.max(a[k], b[k]);
      lo[k] = Math.min(lo[k], entry.min[k]);
      hi[k] = Math.max(hi[k], entry.max[k]);
      extent[k] += entry.max[k] - entry.min[k];
    }
    entries.push(entry);
  }

  // Sweep axis: the one the segments cover the smallest share of (the seams
  // of a wall all span its full height, but are spread across its width).
  let sweep = "x";
  let bestCover = Infinity;
  for (const k of AXES) {
    const range = hi[k] - lo[k];
    if (!(range > 0)) continue;
    const cover = extent[k] / range;
    if (cover < bestCover) {
      bestCover = cover;
      sweep = k;
    }
  }
  const others = AXES.filter((k) => k !== sweep);
  entries.sort((e, f) => e.min[sweep] - f.min[sweep]);

  const distanceToLine = (p, ref) => {
    const v = sub(p, ref.a);
    const t = dot(v, ref.dir);
    return Math.hypot(
      v.x - t * ref.dir.x,
      v.y - t * ref.dir.y,
      v.z - t * ref.dir.z
    );
  };
  // Removes from e the stretch covered by f.
  const subtract = (e, f) => {
    if (!e.kept.length) return;
    const s0 = dot(sub(f.a, e.a), e.dir);
    const s1 = dot(sub(f.b, e.a), e.dir);
    const c0 = Math.min(s0, s1) - EPS_T;
    const c1 = Math.max(s0, s1) + EPS_T;
    const next = [];
    for (const [k0, k1] of e.kept) {
      if (c1 <= k0 || c0 >= k1) {
        next.push([k0, k1]);
        continue;
      }
      if (c0 > k0) next.push([k0, c0]);
      if (c1 < k1) next.push([c1, k1]);
    }
    e.kept = next;
  };

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const n1 = normals[e.faceIdx];
    if (!n1) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const f = entries[j];
      if (f.min[sweep] > e.max[sweep] + SAME_LINE_TOL) break;
      if (f.faceIdx === e.faceIdx) continue;
      if (
        others.some(
          (k) =>
            f.min[k] > e.max[k] + SAME_LINE_TOL ||
            f.max[k] < e.min[k] - SAME_LINE_TOL
        )
      ) {
        continue;
      }
      const n2 = normals[f.faceIdx];
      if (!n2 || dot(n1, n2) < cosT) continue;
      const [ref, other] = e.len >= f.len ? [e, f] : [f, e];
      if (
        distanceToLine(other.a, ref) > SAME_LINE_TOL ||
        distanceToLine(other.b, ref) > SAME_LINE_TOL
      ) {
        continue;
      }
      subtract(e, f);
      subtract(f, e);
    }
  }

  const out = [];
  // Kept seams at real corners (dihedral >= threshold) come out once per
  // face — dedupe exact duplicates so strokes keep their nominal opacity.
  const seen = new Set();
  const qKey = (p) =>
    `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  const at = (e, t) => ({
    x: e.a.x + t * e.dir.x,
    y: e.a.y + t * e.dir.y,
    z: e.a.z + t * e.dir.z,
  });
  for (const e of entries) {
    for (const [k0, k1] of e.kept) {
      if (k1 - k0 < MIN_KEEP_T) continue;
      // Untouched segments keep their exact endpoints so the quantized
      // dedupe below still collapses duplicates at real corners.
      const whole = k0 === 0 && k1 === e.len;
      const pa = whole ? e.a : at(e, k0);
      const pb = whole ? e.b : at(e, k1);
      const ka = qKey(pa);
      const kb = qKey(pb);
      const key = ka <= kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
  }
  return out;
}

export default function extractPlanarSketchEdges(
  geometry,
  { seamDihedralDeg = 0 } = {}
) {
  const position = geometry?.getAttribute?.("position");
  if (!position) return null;
  const index = geometry.getIndex?.();
  const triCount = Math.floor((index ? index.count : position.count) / 3);
  if (!triCount || triCount > MAX_TRIS) return null;

  const vertIndex = index
    ? (t, c) => index.getX(3 * t + c)
    : (t, c) => 3 * t + c;
  const point = (vi) => ({
    x: position.getX(vi),
    y: position.getY(vi),
    z: position.getZ(vi),
  });

  const triangles = [];
  for (let t = 0; t < triCount; t++) {
    const triangle = toSoupTriangle(
      point(vertIndex(t, 0)),
      point(vertIndex(t, 1)),
      point(vertIndex(t, 2)),
      MIN_TRIANGLE_AREA2
    );
    if (triangle) triangles.push(triangle);
  }
  if (!triangles.length) return null;

  const faces = groupTrianglesByPlane(triangles).flatMap((group) =>
    coalesceCoplanarFaces(group.faces)
  );

  if (seamDihedralDeg > 0) {
    const segments = [];
    faces.forEach((face, faceIdx) => {
      if (!face?.contour || face.contour.length < 3) return;
      const collect = (loop) => {
        for (let i = 0; i < loop.length; i++) {
          segments.push({
            a: loop[i],
            b: loop[(i + 1) % loop.length],
            faceIdx,
          });
        }
      };
      collect(face.contour);
      (face.holes || []).forEach(collect);
    });
    const filtered = suppressLowDihedralSeams(
      segments,
      faces.map((f) => f?.normal),
      seamDihedralDeg
    );
    return filtered.length ? new Float32Array(filtered) : null;
  }

  const out = [];
  const pushLoop = (loop) => {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };
  for (const face of faces) {
    if (!face?.contour || face.contour.length < 3) continue;
    pushLoop(face.contour);
    (face.holes || []).forEach(pushLoop);
  }
  return out.length ? new Float32Array(out) : null;
}
