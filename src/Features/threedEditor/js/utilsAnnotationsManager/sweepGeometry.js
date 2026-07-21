import { BufferGeometry, Float32BufferAttribute } from "three";

// Pure sweep-geometry helpers shared by the EXTRUSION_PROFILE builder
// (buildExtrudedProfileMesh) and the inline "Extrusion" builder
// (buildInlineExtrusionMesh). No Dexie / app dependencies — node-testable.

// For each guide vertex, compute the in/out segment normals (right-hand rule
// with up = +Z) and combine them into:
//   - "in"  : entering normal/tangent only (boundary of an upstream gap)
//   - "out" : leaving normal/tangent only  (boundary of a downstream gap)
//   - "bis" : mitered bisector at an interior vertex with both segments
//             visible. Two ring entries are emitted: one anchored on the
//             outgoing segment (for the segment leaving this vertex) and one
//             on the incoming segment (for the arriving segment); both reuse
//             the same mitered normal so the rings coincide → continuous
//             surface across the vertex.
//
// Rather than tracking which "side" each ring entry covers, we collapse to a
// single ring per vertex and let `buildSweepGeometryForProfile` use it for
// both adjacent segments — that's the whole point of mitering.
export function computeVertexFrames(points, hidden, closeLine = false) {
  const n = points.length;
  const frames = new Array(n).fill(null);

  // Per-segment plain normals (cached). When the guide is closed there is one
  // extra segment connecting the last point back to the first (index n-1).
  const segCount = closeLine ? n : n - 1;
  const segN = new Array(segCount).fill(null);
  for (let i = 0; i < segCount; i++) {
    if (hidden.has(i)) continue;
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (T × Z_up): (ty, -tx, 0)
    segN[i] = { nx: ty, ny: -tx };
  }

  for (let v = 0; v < n; v++) {
    // Closed: every vertex has both an incoming and an outgoing segment
    // (wrap-around). Open: the endpoints fall back to their single segment.
    const inN = closeLine ? segN[(v - 1 + n) % n] : v > 0 ? segN[v - 1] : null;
    const outN = closeLine ? segN[v] : v < n - 1 ? segN[v] : null;

    if (inN && outN) {
      // Mitered: M = (Ni + No) / (1 + Ni · No). Falls back to plain "out"
      // normal when the two segments fold back on themselves (denom ~ 0).
      const dot = inN.nx * outN.nx + inN.ny * outN.ny;
      const denom = 1 + dot;
      if (denom > 1e-6) {
        frames[v] = {
          nx: (inN.nx + outN.nx) / denom,
          ny: (inN.ny + outN.ny) / denom,
        };
      } else {
        frames[v] = { nx: outN.nx, ny: outN.ny };
      }
    } else if (inN) {
      frames[v] = { nx: inN.nx, ny: inN.ny };
    } else if (outN) {
      frames[v] = { nx: outN.nx, ny: outN.ny };
    }
    // else: vertex unreachable (both adjacent segments hidden / degenerate).
  }
  return frames;
}

// Build a quad strip mesh: each visible guide segment connects the rings
// computed at its two endpoint vertices. Adjacent visible segments share
// their mid-vertex ring → continuous surface.
export function buildSweepGeometryForProfile(
  guidePoints,
  vertexFrames,
  hidden,
  profileLocal,
  verticalLift,
  closeLine = false
) {
  const positions = [];
  const indices = [];
  let v = 0;

  // Cache the start ring across iterations so adjacent visible segments
  // genuinely SHARE their mid-vertex ring (single set of vertices in the
  // buffer, not duplicated rings at the same coords).
  let prevSegmentEndIdx = -1;
  let prevEndVertexIndex = -1;

  // Closed guide: also sweep the closing segment (last → first), so the
  // surface wraps all the way around (e.g. a full dome) instead of leaving a
  // wedge-shaped gap.
  const n = guidePoints.length;
  const segCount = closeLine ? n : n - 1;

  for (let i = 0; i < segCount; i++) {
    if (hidden.has(i)) {
      prevSegmentEndIdx = -1;
      prevEndVertexIndex = -1;
      continue;
    }
    const endVertex = (i + 1) % n;
    const fA = vertexFrames[i];
    const fB = vertexFrames[endVertex];
    if (!fA || !fB) {
      prevSegmentEndIdx = -1;
      prevEndVertexIndex = -1;
      continue;
    }
    const a = guidePoints[i];
    const b = guidePoints[endVertex];

    // Reuse previous segment's end ring as this segment's start ring iff the
    // previous visible segment ended at this same vertex.
    let startBaseIdx;
    if (prevSegmentEndIdx >= 0 && prevEndVertexIndex === i) {
      startBaseIdx = prevSegmentEndIdx;
    } else {
      startBaseIdx = v;
      for (let j = 0; j < profileLocal.length; j++) {
        const p = profileLocal[j];
        positions.push(
          a.x + p.x * fA.nx,
          a.y + p.x * fA.ny,
          p.y + verticalLift
        );
      }
      v += profileLocal.length;
    }

    const endBaseIdx = v;
    for (let j = 0; j < profileLocal.length; j++) {
      const p = profileLocal[j];
      positions.push(b.x + p.x * fB.nx, b.y + p.x * fB.ny, p.y + verticalLift);
    }
    v += profileLocal.length;

    // Two triangles per quad between profile vertices j and j+1.
    for (let j = 0; j < profileLocal.length - 1; j++) {
      const a0 = startBaseIdx + j;
      const a1 = startBaseIdx + (j + 1);
      const b0 = endBaseIdx + j;
      const b1 = endBaseIdx + (j + 1);
      indices.push(a0, b0, b1, a0, b1, a1);
    }

    prevSegmentEndIdx = endBaseIdx;
    prevEndVertexIndex = endVertex;
  }

  if (positions.length === 0) return null;

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
