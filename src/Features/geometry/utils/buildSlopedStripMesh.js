import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import { offsetPolyline } from "Features/geometry/utils/offsetPolylineAsPolygon";
import { computeOffsetPolyline } from "Features/geometry/utils/wallToRectRing";
import shrinkPolylineEnds from "Features/geometry/utils/shrinkPolylineEnds";
import { expandRingWithOffsets } from "Features/geometry/utils/arcSampling";
import {
  getStripChunks,
  getStripDistancePx,
} from "Features/geometry/utils/getStripePolygons";

// Match the codebase convention used by other arc-aware paths.
const ARC_SAMPLES = 6;
// Drop consecutive duplicate points within this pixel threshold (same value as
// extrudeWallPolygon) so the offset never sees a zero-length segment (which it
// skips, breaking the station ↔ station correspondence).
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

// Resolve a STRIP into elevated ribbons. A closed strip becomes ONE closed loop
// ribbon (hidden segments ignored, consistent with the flat annular path which
// builds the full donut); an open strip becomes one ribbon per visible chunk.
export function getSlopedStripRibbons(annotation) {
  const { effectiveCloseLine, effectivePoints, chunks } =
    getStripChunks(annotation);
  if (effectiveCloseLine && effectivePoints.length >= 3) {
    return [{ points: effectivePoints, closeLine: true }];
  }
  return (chunks || []).map((points) => ({ points, closeLine: false }));
}

// Build the two rails (PIXEL space) of one ribbon, station-correspondent, with
// offsetTop carried on rail A. Rail B (the parallel offset) uses the open miter
// offset for open ribbons, and the wrapping closed-ring offset (1:1 vertex
// count) for closed ones. Returns { railA, railB, closeLine } or null.
//
// `shrinkPx` (opt-in, 3D anti-aliasing only — quantity consumers keep the
// default 0 so they measure true dimensions) contracts the ribbon uniformly:
// both rails move toward the band interior by `shrinkPx` (clamped so at least
// 15% of the band width remains) and, for open ribbons, the ends are trimmed
// by the same amount. The ribbon stays centered on the original band axis.
export function buildStripRails({
  points,
  distance,
  closeLine = false,
  shrinkPx = 0,
}) {
  if (!points || points.length < 2) return null;

  // Expand arcs (carrying offsetTop along the curve), then drop duplicate points
  // so the offset keeps a 1:1 station correspondence.
  const expanded =
    points.length >= 3
      ? expandRingWithOffsets(points, ARC_SAMPLES, closeLine)
      : points;
  const railA = dedupeConsecutive(expanded);
  if (railA.length < 2) return null;

  if (shrinkPx > 0 && Math.abs(distance) > 0) {
    // `distance` is signed (left-of-travel via stripOrientation), so
    // `sign * effShrink` always moves the stored edge toward the band interior
    // and `distance - sign * effShrink` pulls the far edge back symmetrically.
    const sign = Math.sign(distance) || 1;
    const effShrink = Math.min(shrinkPx, Math.abs(distance) * 0.425);
    // End-cap trim first (open ribbons only) — length-preserving, so the
    // station ↔ offsetTop mapping survives.
    const base = closeLine ? railA : shrinkPolylineEnds(railA, shrinkPx);
    const off = (d) =>
      closeLine
        ? computeOffsetPolyline(base, d, true)
        : offsetPolyline(base, d);
    const a = off(sign * effShrink);
    const b = off(distance - sign * effShrink);
    if (a && b && a.length === base.length && b.length === base.length) {
      // The offset helpers strip offsetTop → copy it back per station.
      const railAShrunk = a.map((p, i) => ({
        ...p,
        offsetTop: base[i].offsetTop,
      }));
      return { railA: railAShrunk, railB: b, closeLine };
    }
    // Degenerate offset → fall through to the un-shrunk rails.
  }

  const railB = closeLine
    ? computeOffsetPolyline(railA, distance, true)
    : offsetPolyline(railA, distance);
  if (!railB || railB.length !== railA.length) return null;

  return { railA, railB, closeLine };
}

// Build a single-surface ("nappe sans épaisseur") quad-strip mesh for ONE ribbon
// of a sloped STRIP, directly from the centerline + width — no polygon-clipping,
// so per-point elevation survives and each station yields a real transverse edge
// (clean horizontal↔slope junction).
//
// Model (confirmed): per-station elevation comes from offsetTop; both band edges
// on a line orthogonal to the centerline share that altitude, so the surface is
// horizontal across its width and tilts only along the path where offsetTop
// changes. z = verticalLift + offsetTop (+ zFightOffset).
//
// Inputs are PIXEL space; output positions are in basemap-LOCAL world units (Z
// already includes the lift). Returns { positions, indices, transverseSegments }
// or null. When closeLine is true the ribbon wraps (last station → first).
export default function buildSlopedStripMesh({
  points,
  distance,
  baseMap,
  verticalLift = 0,
  zFightOffset = 0.001,
  closeLine = false,
  shrinkPx = 0,
}) {
  const rails = buildStripRails({ points, distance, closeLine, shrinkPx });
  if (!rails) return null;
  const { railA, railB } = rails;
  const N = railA.length;

  // Vertices: 2i = rail A, 2i+1 = rail B; both at the station's offsetTop z.
  const positions = [];
  for (let i = 0; i < N; i++) {
    const z = verticalLift + (railA[i].offsetTop ?? 0) + zFightOffset;
    const a = pixelToWorld(railA[i], baseMap);
    const b = pixelToWorld(railB[i], baseMap);
    positions.push(a.x, a.y, z);
    positions.push(b.x, b.y, z);
  }

  // Quad-strip triangulation. The transverse edges A_i↔B_i are real shared edges
  // between adjacent quads → the fold at a horizontal↔slope corner is clean
  // (earcut over the footprint cannot guarantee this).
  const indices = [];
  const segCount = closeLine ? N : N - 1;
  for (let s = 0; s < segCount; s++) {
    const a0 = 2 * s;
    const b0 = 2 * s + 1;
    const j = (s + 1) % N;
    const a1 = 2 * j;
    const b1 = 2 * j + 1;
    indices.push(a0, b0, b1);
    indices.push(a0, b1, a1);
  }
  if (indices.length === 0) return null;

  // Transverse junction segments — only at fold stations (where the along-path
  // slope sign changes, i.e. horizontal↔slope). Avoids a noisy web of lines.
  const transverseSegments = [];
  const otOf = (k) => railA[((k % N) + N) % N].offsetTop ?? 0;
  const start = closeLine ? 0 : 1;
  const end = closeLine ? N : N - 1;
  for (let i = start; i < end; i++) {
    const dPrev = otOf(i) - otOf(i - 1);
    const dNext = otOf(i + 1) - otOf(i);
    const prevFlat = Math.abs(dPrev) < SLOPE_EPS;
    const nextFlat = Math.abs(dNext) < SLOPE_EPS;
    const isFold = prevFlat !== nextFlat || dPrev * dNext < 0;
    if (!isFold) continue;
    const z = verticalLift + otOf(i) + zFightOffset;
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

// 3D area of a triangle whose vertices are {x,y,z} (any consistent unit).
function triArea3D(p, q, r) {
  const ux = q.x - p.x;
  const uy = q.y - p.y;
  const uz = q.z - p.z;
  const vx = r.x - p.x;
  const vy = r.y - p.y;
  const vz = r.z - p.z;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return 0.5 * Math.hypot(cx, cy, cz);
}

// Developed (3D) length (centerline) + surface (ribbon top face) of ONE ribbon,
// in meters / m². Computed from the SAME rails as the mesh so quantities and the
// rendered surface stay consistent.
export function getRibbonDevelopedQty({
  points,
  distance,
  meterByPx,
  closeLine = false,
}) {
  const rails = buildStripRails({ points, distance, closeLine });
  if (!rails) return { length: 0, surface: 0 };
  const { railA, railB } = rails;
  const N = railA.length;

  // Convert a (pixel x,y) point + its station altitude to meters.
  const toM = (p, ot) => ({ x: p.x * meterByPx, y: p.y * meterByPx, z: ot });

  let length = 0;
  let surface = 0;
  const segCount = closeLine ? N : N - 1;
  for (let s = 0; s < segCount; s++) {
    const i = s;
    const j = (s + 1) % N;
    const otI = railA[i].offsetTop ?? 0;
    const otJ = railA[j].offsetTop ?? 0;
    const ai = toM(railA[i], otI);
    const bi = toM(railB[i], otI);
    const aj = toM(railA[j], otJ);
    const bj = toM(railB[j], otJ);
    length += Math.hypot(aj.x - ai.x, aj.y - ai.y, aj.z - ai.z);
    surface += triArea3D(ai, bi, bj) + triArea3D(ai, bj, aj);
  }
  return { length, surface };
}

// Total developed length + surface (meters / m²) of an elevated STRIP across all
// its ribbons, or null when it cannot be computed.
export function computeSlopedStripQty({ annotation, meterByPx }) {
  if (!meterByPx || !Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  const ribbons = getSlopedStripRibbons(annotation);
  if (!ribbons.length) return null;
  const distance = getStripDistancePx(annotation, meterByPx);

  let length = 0;
  let surface = 0;
  for (const ribbon of ribbons) {
    const q = getRibbonDevelopedQty({
      points: ribbon.points,
      distance,
      meterByPx,
      closeLine: ribbon.closeLine,
    });
    length += q.length;
    surface += q.surface;
  }
  return { length, surface };
}
