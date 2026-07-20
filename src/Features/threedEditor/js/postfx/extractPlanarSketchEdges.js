import coalesceCoplanarFaces from "Features/threedMesh/utils/coalesceCoplanarFaces.js";
import {
  cross,
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

export default function extractPlanarSketchEdges(geometry) {
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
