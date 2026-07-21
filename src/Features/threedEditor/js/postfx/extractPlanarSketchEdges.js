import coalesceCoplanarFaces from "Features/threedMesh/utils/coalesceCoplanarFaces.js";
import {
  cross,
  dot,
  length,
  scale,
  sub,
} from "Features/threedMesh/utils/vec3Utils.js";

// Feature-edge extraction for CSG-carved geometries (three-bvh-csg triangle
// soup). EdgesGeometry pairs triangles by exact edge endpoints, but boolean
// cuts leave T-junctions (a vertex of one triangle sits mid-edge of its
// neighbor): those interior edges have no detectable twin, so EdgesGeometry
// draws them as silhouette strokes slashing across flat faces.
//
// Instead, every triangle becomes a tiny planar face and coalesceCoplanarFaces
// unions each coplanar cluster in 2D — T-junction seams dissolve, collinear
// interior vertices are cleaned up — leaving only the true outlines
// (contour + hole loops) of each planar face. This trades the EdgesGeometry
// dihedral-angle threshold for "all planar-face outlines", which is exactly
// right for carved extrusions (every real edge is a ~90° corner).
//
// Returns a flat [x1,y1,z1,x2,y2,z2, ...] segment-pair array in mesh-LOCAL
// coordinates (same contract as EdgesGeometry positions), or null when the
// geometry is unusable — callers then fall back to EdgesGeometry.

// Above this the per-triangle union cost is not worth it (CSG-carved
// annotation solids stay in the hundreds of triangles).
const MAX_TRIS = 20_000;

// Interval tolerances for the seam suppression, in mesh-local units. EPS_T
// absorbs float noise when matching collinear overlaps; kept pieces shorter
// than MIN_KEEP_T are quantization slivers, not real edges.
const EPS_T = 1e-3;
const MIN_KEEP_T = 2e-3;

// Suppress the portions of face-outline segments that are shared with another
// face whose plane is within `thresholdDeg` (dihedral angle between facets).
// Such seams are construction artifacts (arc sampling, stairs subdivisions):
// two nearly-coplanar facets end up in different coalesced clusters, and the
// cluster outlines both trace their common boundary.
//
// Segments are bucketed by their supporting 3D line, then each segment
// subtracts the parameter intervals covered by segments of OTHER faces on the
// same line with dot(n1, n2) >= cos(threshold). Interval subtraction (not
// exact-key matching) also handles partial overlaps: on a stair step only the
// shared upper portion of the seam dissolves, the step notch stays drawn.
// The dot is signed so a wall folding back on itself (~180°) keeps its edge.
function suppressLowDihedralSeams(segments, normals, thresholdDeg) {
  const cosT = Math.cos((thresholdDeg * Math.PI) / 180);
  const qDir = (v) => Math.round(v * 1e5);
  const qAnchor = (v) => Math.round(v * 1e3);

  const buckets = new Map();
  const entries = [];
  for (const { a, b, faceIdx } of segments) {
    const d = sub(b, a);
    const len = length(d);
    if (len < 1e-9) continue;
    let dir = scale(d, 1 / len);
    // Canonical orientation: first non-negligible component positive, so both
    // traversal directions of the same line land in the same bucket.
    if (
      dir.x < -1e-9 ||
      (dir.x < 1e-9 && (dir.y < -1e-9 || (dir.y < 1e-9 && dir.z < 0)))
    ) {
      dir = scale(dir, -1);
    }
    const tA = dot(a, dir);
    const anchor = sub(a, scale(dir, tA));
    const key =
      `${qDir(dir.x)},${qDir(dir.y)},${qDir(dir.z)}|` +
      `${qAnchor(anchor.x)},${qAnchor(anchor.y)},${qAnchor(anchor.z)}`;
    const tB = dot(b, dir);
    const entry = {
      a,
      b,
      faceIdx,
      tA,
      tB,
      t0: Math.min(tA, tB),
      t1: Math.max(tA, tB),
    };
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push(entry);
    entry.bucket = bucket;
    entries.push(entry);
  }

  const out = [];
  // Kept seams at real corners (dihedral >= threshold) come out once per
  // face — dedupe exact duplicates so strokes keep their nominal opacity.
  const seen = new Set();
  const qKey = (p) =>
    `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  const lerp = (e, t) => {
    const s = (t - e.tA) / (e.tB - e.tA);
    return {
      x: e.a.x + s * (e.b.x - e.a.x),
      y: e.a.y + s * (e.b.y - e.a.y),
      z: e.a.z + s * (e.b.z - e.a.z),
    };
  };
  for (const e of entries) {
    let kept = [[e.t0, e.t1]];
    for (const f of e.bucket) {
      if (f === e || f.faceIdx === e.faceIdx) continue;
      const n1 = normals[e.faceIdx];
      const n2 = normals[f.faceIdx];
      if (!n1 || !n2 || dot(n1, n2) < cosT) continue;
      const c0 = f.t0 - EPS_T;
      const c1 = f.t1 + EPS_T;
      const next = [];
      for (const [k0, k1] of kept) {
        if (c1 <= k0 || c0 >= k1) {
          next.push([k0, k1]);
          continue;
        }
        if (c0 > k0) next.push([k0, c0]);
        if (c1 < k1) next.push([c1, k1]);
      }
      kept = next;
      if (!kept.length) break;
    }
    for (const [k0, k1] of kept) {
      if (k1 - k0 < MIN_KEEP_T) continue;
      // Untouched segments keep their exact endpoints so the quantized
      // dedupe below still collapses duplicates at real corners.
      const pa = k0 === e.t0 && k1 === e.t1 ? e.a : lerp(e, k0);
      const pb = k0 === e.t0 && k1 === e.t1 ? e.b : lerp(e, k1);
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

  const triFaces = [];
  for (let t = 0; t < triCount; t++) {
    const pa = point(vertIndex(t, 0));
    const pb = point(vertIndex(t, 1));
    const pc = point(vertIndex(t, 2));
    const n = cross(sub(pb, pa), sub(pc, pa));
    const len = length(n);
    if (len < 1e-12) continue; // degenerate triangle
    triFaces.push({
      contour: [pa, pb, pc],
      holes: [],
      normal: scale(n, 1 / len),
    });
  }
  if (!triFaces.length) return null;

  const faces = coalesceCoplanarFaces(triFaces);

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
