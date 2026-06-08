import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import { expandRingWithOffsets } from "Features/geometry/utils/arcSampling";

// Match the codebase convention used by other arc-aware paths.
const ARC_SAMPLES = 6;
// Drop consecutive duplicate points within this pixel threshold (same value as
// extrudeWallPolygon) so offsetPolyline never sees a zero-length segment (which
// it skips, breaking the station ↔ station correspondence).
const DEDUP_EPS_PX = 0.1;
const SLOPE_EPS = 1e-9;

// Drop consecutive duplicate points (within DEDUP_EPS_PX), keeping the point
// objects intact (so offsetTop survives).
function dedupeConsecutive(points) {
  if (!points || points.length === 0) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    if (
      Math.abs(p.x - prev.x) > DEDUP_EPS_PX ||
      Math.abs(p.y - prev.y) > DEDUP_EPS_PX
    ) {
      out.push(p);
    }
  }
  return out;
}

// Build a single-surface ("nappe sans épaisseur") quad-strip mesh for ONE
// visible chunk of a sloped STRIP, directly from the centerline + width — no
// polygon-clipping, so per-point elevation survives and each station yields a
// real transverse edge (clean horizontal↔slope junction).
//
// Model (confirmed): per-station elevation comes from offsetTop; both band edges
// on a line orthogonal to the centerline share that altitude, so the surface is
// horizontal across its width and tilts only along the path where offsetTop
// changes. z = verticalLift + offsetTop (+ zFightOffset).
//
// Inputs are PIXEL space; output positions are in basemap-LOCAL world units
// (Z already includes the lift). Returns { positions, indices,
// transverseSegments } or null.
export default function buildSlopedStripMesh({
  chunkPoints,
  distance,
  baseMap,
  verticalLift = 0,
  zFightOffset = 0.001,
}) {
  if (!chunkPoints || chunkPoints.length < 2) return null;

  // 1. Expand arcs (carrying offsetTop along the curve), then drop duplicate
  //    points so offsetPolyline keeps a 1:1 station correspondence.
  const expanded =
    chunkPoints.length >= 3
      ? expandRingWithOffsets(chunkPoints, ARC_SAMPLES, false)
      : chunkPoints;
  const railA = dedupeConsecutive(expanded);
  if (railA.length < 2) return null;

  // 2. Parallel offset line (rail B) — same point count, station i ↔ i.
  const railB = offsetPolyline(railA, distance);
  if (!railB || railB.length !== railA.length) return null;

  // 3. Vertices: 2i = rail A, 2i+1 = rail B; both at the station's offsetTop z.
  const N = railA.length;
  const positions = [];
  for (let i = 0; i < N; i++) {
    const z = verticalLift + (railA[i].offsetTop ?? 0) + zFightOffset;
    const a = pixelToWorld(railA[i], baseMap);
    const b = pixelToWorld(railB[i], baseMap);
    positions.push(a.x, a.y, z);
    positions.push(b.x, b.y, z);
  }

  // 4. Quad-strip triangulation. The transverse edges A_i↔B_i are real shared
  //    edges between adjacent quads → the fold at a horizontal↔slope corner is
  //    clean (earcut over the footprint cannot guarantee this).
  const indices = [];
  for (let i = 0; i < N - 1; i++) {
    const a0 = 2 * i;
    const b0 = 2 * i + 1;
    const a1 = 2 * i + 2;
    const b1 = 2 * i + 3;
    indices.push(a0, b0, b1);
    indices.push(a0, b1, a1);
  }
  if (indices.length === 0) return null;

  // 5. Transverse junction segments — only at fold stations (where the along-
  //    path slope sign changes, i.e. horizontal↔slope). Avoids a noisy web.
  const transverseSegments = [];
  for (let i = 1; i < N - 1; i++) {
    const dPrev = (railA[i].offsetTop ?? 0) - (railA[i - 1].offsetTop ?? 0);
    const dNext = (railA[i + 1].offsetTop ?? 0) - (railA[i].offsetTop ?? 0);
    const prevFlat = Math.abs(dPrev) < SLOPE_EPS;
    const nextFlat = Math.abs(dNext) < SLOPE_EPS;
    const isFold = prevFlat !== nextFlat || dPrev * dNext < 0;
    if (!isFold) continue;
    const z = verticalLift + (railA[i].offsetTop ?? 0) + zFightOffset;
    const a = pixelToWorld(railA[i], baseMap);
    const b = pixelToWorld(railB[i], baseMap);
    transverseSegments.push(a.x, a.y, z, b.x, b.y, z);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    transverseSegments,
  };
}
