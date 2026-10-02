import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

import { paintGeometryToLocal } from "./meshPaintFrame.js";

// Where the painted parts of a host go when the host is split in plan (2D
// cut of a POLYGON / wall, « Coupe face » 2D splits, scissors): each part is
// classified from its PLAN projection against the 2D shape of every
// resulting piece.
//
// - KEEP (rehostTo null, copyTo []): the part lies on the source piece only.
// - REHOST (rehostTo = piece): it lies on ONE other piece only (a wall end
//   cap, the front face of a slab cut parallel to it) — the row is moved
//   there as is, so it never re-attaches to the source's new cut face.
// - SPAN (copyTo = pieces): it lies across several pieces — kept on the
//   source (or re-hosted to its main piece when the source holds none) with
//   provisional copies on the others (the re-sync trims each to its piece).
// - unknown (no piece holds it: stale geometry, a removed middle part...):
//   kept on the source, copies on every other piece (the re-sync decides).
//
// Plan sampling of a part (base-map-local meters):
// - a face facing up / down (|n.z| ≥ PLAN_FACE_MIN_NZ): grid samples inside
//   its projected loops, weighted by area;
// - a vertical face or an edge: samples along its projected outline,
//   weighted by length (a vertical face projects onto a segment).
//
// Pieces:
// - POLYGON {outline, holes}: a sample inside the outline (minus holes) is
//   at distance 0; one outside within PLAN_TOL_M of its boundary (a face
//   lying on the outline) is at its boundary distance.
// - WALL {line, closed, halfWidthM}: the polyline buffered by its half
//   thickness (+ PLAN_TOL_M, × MITER_FACTOR at the joints), with FLAT ends
//   extended by PLAN_TOL_M only: the mitered corner of a wall split at that
//   corner belongs to neither piece instead of to both.
// A sample goes to the nearest piece holding it (ties within TIE_TOL_M:
// the piece whose nearest segment runs along the part, else shared).
//
// Pure: node-testable.

export const SPLIT_CLASS = {
  KEEP: "KEEP",
  REHOST: "REHOST",
  SPAN: "SPAN",
  UNKNOWN: "UNKNOWN",
};

const PLAN_TOL_M = 0.02;
const TIE_TOL_M = 1e-3;
const MITER_FACTOR = 3;
const PLAN_FACE_MIN_NZ = 0.2;
const TARGET_SAMPLES = 400;
const MIN_STEP_M = 0.002;
// A piece holds a part when it carries at least this share of it, or this
// much of it (absolute: a short piece of a long wall).
const HOLD_MIN_SHARE = 0.005;
const HOLD_MIN_LENGTH_M = 0.02;
const HOLD_MIN_AREA_M2 = 4e-4;
const ALIGN_TIE_TOL = 0.05;

const isFace = (partType) => partType === MESH_PAINT_PART_TYPES.FACE;

// --- 2D helpers ---

const sub2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len2 = (a) => Math.hypot(a.x, a.y);

function ringArea2(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function isInsideRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Nearest point of segment ab to p: {distance, t (0..1), dir (unit)}.
function segmentProjection(p, a, b) {
  const ab = sub2(b, a);
  const abLength = len2(ab);
  if (!(abLength > 0)) {
    return { distance: len2(sub2(p, a)), t: 0, dir: null, length: 0 };
  }
  const dir = { x: ab.x / abLength, y: ab.y / abLength };
  const along = (p.x - a.x) * dir.x + (p.y - a.y) * dir.y;
  const t = Math.max(0, Math.min(1, along / abLength));
  const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { distance: len2(sub2(p, q)), t, along, dir, length: abLength };
}

function ringSegments(ring, closed) {
  const out = [];
  const n = ring.length;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) out.push([ring[i], ring[(i + 1) % n]]);
  return out;
}

// --- pieces ---

function preparePiece(piece) {
  if (piece.kind === "POLYGON") {
    const outline = (piece.outline || []).filter(Boolean);
    const holes = (piece.holes || []).filter((h) => h?.length >= 3);
    if (outline.length < 3) return null;
    return {
      ...piece,
      outline,
      holes,
      segments: [outline, ...holes].flatMap((ring) => ringSegments(ring, true)),
    };
  }
  const line = (piece.line || []).filter(Boolean);
  if (line.length < 2) return null;
  const closed = Boolean(piece.closed) && line.length >= 3;
  return {
    ...piece,
    kind: "WALL",
    line,
    closed,
    halfWidthM: Math.max(0, Number(piece.halfWidthM) || 0),
    segments: ringSegments(line, closed),
  };
}

// Distance of a sample to a piece (null when the piece does not hold it)
// and the direction of the piece's nearest segment.
function locateOnPiece(p, piece) {
  let best = null;
  piece.segments.forEach(([a, b], index) => {
    const projection = segmentProjection(p, a, b);
    if (!best || projection.distance < best.distance) {
      best = { ...projection, index };
    }
  });
  if (!best) return null;

  if (piece.kind === "POLYGON") {
    const inside =
      isInsideRing(p, piece.outline) &&
      !piece.holes.some((hole) => isInsideRing(p, hole));
    if (inside) return { distance: 0, dir: best.dir };
    return best.distance <= PLAN_TOL_M
      ? { distance: best.distance, dir: best.dir }
      : null;
  }

  // WALL: flat ends extended by PLAN_TOL_M only.
  if (!piece.closed) {
    const last = piece.segments.length - 1;
    if (best.index === 0 && best.t === 0 && best.along < 0) {
      if (-best.along > PLAN_TOL_M) return null;
    }
    if (best.index === last && best.t === 1 && best.along > best.length) {
      if (best.along - best.length > PLAN_TOL_M) return null;
    }
  }
  const atJoint =
    (best.t === 0 && (piece.closed || best.index > 0)) ||
    (best.t === 1 && (piece.closed || best.index < piece.segments.length - 1));
  const radius = piece.halfWidthM * (atJoint ? MITER_FACTOR : 1) + PLAN_TOL_M;
  return best.distance <= radius
    ? { distance: best.distance, dir: best.dir }
    : null;
}

// --- part sampling (local meters, plan = x, y) ---

function sampleSegment(a, b, step, tangent, out) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(length > 0)) return;
  const count = Math.max(1, Math.ceil(length / step));
  const weight = length / count;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      weight,
      tangent,
    });
  }
}

function sampleOutline(loops, tangent) {
  const segments = loops.flatMap((loop) => ringSegments(loop, true));
  const total = segments.reduce(
    (sum, [a, b]) => sum + Math.hypot(b.x - a.x, b.y - a.y),
    0
  );
  const samples = [];
  if (!(total > 0)) return samples;
  const step = Math.max(MIN_STEP_M, total / TARGET_SAMPLES);
  segments.forEach(([a, b]) => sampleSegment(a, b, step, tangent, samples));
  return samples;
}

function sampleArea(polygons) {
  const samples = [];
  for (const polygon of polygons) {
    const contour = polygon.contour;
    const holes = polygon.holes || [];
    const area = Math.abs(ringArea2(contour));
    if (!(area > 0)) continue;
    const xs = contour.map((p) => p.x);
    const ys = contour.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const step = Math.max(MIN_STEP_M, Math.sqrt(area / TARGET_SAMPLES));
    const weight = step * step;
    for (let x = minX + step / 2; x < maxX; x += step) {
      for (let y = minY + step / 2; y < maxY; y += step) {
        const p = { x, y };
        if (!isInsideRing(p, contour)) continue;
        if (holes.some((hole) => isInsideRing(p, hole))) continue;
        samples.push({ x, y, weight, tangent: null });
      }
    }
  }
  return samples;
}

function samplePart(row, metrics) {
  const local = paintGeometryToLocal(row.partType, row.geometry, metrics);
  if (!local) return null;
  const plan = (v) => ({ x: v.x, y: v.y });

  if (!isFace(row.partType)) {
    const [a, b] = [local.points[0], local.points[local.points.length - 1]];
    const d = { x: b.x - a.x, y: b.y - a.y };
    const length = Math.hypot(d.x, d.y);
    if (!(length > MIN_STEP_M)) {
      return {
        mode: "LENGTH",
        samples: [{ ...plan(a), weight: 1, tangent: null }],
        unit: 1,
      };
    }
    const samples = [];
    const step = Math.max(MIN_STEP_M, length / TARGET_SAMPLES);
    sampleSegment(
      plan(a),
      plan(b),
      step,
      { x: d.x / length, y: d.y / length },
      samples
    );
    return { mode: "LENGTH", samples, unit: 1 };
  }

  const polygons = local.polygons.map((polygon) => ({
    contour: polygon.contour.map(plan),
    holes: (polygon.holes || []).map((hole) => hole.map(plan)),
  }));
  if (Math.abs(local.normal.z) >= PLAN_FACE_MIN_NZ) {
    const samples = sampleArea(polygons);
    if (samples.length) return { mode: "AREA", samples, unit: 1 };
  }
  const horizontal = Math.hypot(local.normal.x, local.normal.y);
  const tangent =
    horizontal > 1e-6
      ? { x: -local.normal.y / horizontal, y: local.normal.x / horizontal }
      : null;
  const samples = sampleOutline(
    polygons.flatMap((polygon) => [polygon.contour, ...polygon.holes]),
    tangent
  );
  if (samples.length) return { mode: "LENGTH", samples, unit: 1 };
  const c = local.polygons[0].contour[0];
  return {
    mode: "LENGTH",
    samples: [{ x: c.x, y: c.y, weight: 1, tangent: null }],
    unit: 1,
  };
}

// Share of the part each piece holds (by piece index).
function measureShares(samples, pieces) {
  const covered = new Array(pieces.length).fill(0);
  let total = 0;
  for (const sample of samples) {
    total += sample.weight;
    const hits = [];
    pieces.forEach((piece, index) => {
      const hit = locateOnPiece(sample, piece);
      if (hit) hits.push({ index, ...hit });
    });
    if (!hits.length) continue;
    const dMin = Math.min(...hits.map((h) => h.distance));
    let nearest = hits.filter((h) => h.distance <= dMin + TIE_TOL_M);
    if (nearest.length > 1 && sample.tangent) {
      const alignment = (h) =>
        h.dir
          ? Math.abs(h.dir.x * sample.tangent.x + h.dir.y * sample.tangent.y)
          : 0;
      const best = Math.max(...nearest.map(alignment));
      nearest = nearest.filter((h) => alignment(h) >= best - ALIGN_TIE_TOL);
    }
    nearest.forEach((h) => {
      covered[h.index] += sample.weight / nearest.length;
    });
  }
  return { covered, total };
}

/**
 * @param {object} args
 * @param {object[]} args.rows - live db.meshPaints rows of the source host
 * @param {{imageWidth, imageHeight, meterByPx}} args.metrics - of the host's
 *   base map
 * @param {string} args.sourceHostId
 * @param {Array<{hostId: string, kind: "POLYGON", outline: {x, y}[], holes?: {x, y}[][]}
 *   | {hostId: string, kind: "WALL", line: {x, y}[], closed?: boolean, halfWidthM?: number}>} args.pieces
 *   every piece AFTER the split (the source's own piece included), plan
 *   coordinates in base-map-local meters.
 * @returns {Array<{id: string, kind: "KEEP"|"REHOST"|"SPAN"|"UNKNOWN",
 *   rehostTo: string|null, copyTo: string[]}>} one entry per live row.
 */
export default function classifyMeshPaintsForSplit({
  rows,
  metrics,
  sourceHostId,
  pieces,
}) {
  const prepared = (pieces || []).map(preparePiece).filter(Boolean);
  const others = [
    ...new Set(
      (pieces || [])
        .map((piece) => piece?.hostId)
        .filter((id) => id && id !== sourceHostId)
    ),
  ];
  const unknown = (row) => ({
    id: row.id,
    kind: SPLIT_CLASS.UNKNOWN,
    rehostTo: null,
    copyTo: others,
  });

  return (rows || [])
    .filter((row) => row && !row.deletedAt)
    .map((row) => {
      if (!metrics || !prepared.length) return unknown(row);
      const part = samplePart(row, metrics);
      if (!part?.samples.length) return unknown(row);

      const { covered, total } = measureShares(part.samples, prepared);
      if (!(total > 0)) return unknown(row);
      const minAbs =
        part.mode === "AREA" ? HOLD_MIN_AREA_M2 : HOLD_MIN_LENGTH_M;
      const shareByHost = new Map();
      prepared.forEach((piece, index) => {
        shareByHost.set(
          piece.hostId,
          (shareByHost.get(piece.hostId) ?? 0) + covered[index]
        );
      });
      const holders = [...shareByHost.entries()]
        .filter(
          ([, value]) => value >= HOLD_MIN_SHARE * total || value >= minAbs
        )
        .sort((a, b) => b[1] - a[1])
        .map(([hostId]) => hostId);
      if (!holders.length) return unknown(row);

      const onSource = holders.includes(sourceHostId);
      const rehostTo = onSource ? null : holders[0];
      const copyTo = holders.filter(
        (hostId) => hostId !== sourceHostId && hostId !== rehostTo
      );
      let kind = SPLIT_CLASS.KEEP;
      if (copyTo.length) kind = SPLIT_CLASS.SPAN;
      else if (rehostTo) kind = SPLIT_CLASS.REHOST;
      return { id: row.id, kind, rehostTo, copyTo };
    });
}
