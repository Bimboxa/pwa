import polygonClipping from "polygon-clipping";

import getPathChunksInRegion, {
  extendPathEnds,
  isInsideRegion,
  signedArea2d,
} from "../../surfaceCut/utils/getPathChunksInRegion.js";
import splitFlatRegionAlongChunks from "../../surfaceCut/utils/splitFlatRegionAlongChunks.js";
import { expandArcsInPath } from "../../geometry/utils/arcSampling.js";

import { HEIGHT_CUT_SIDE_TOP } from "../constants/heightCutConstants.js";

// Faces of a POLYGON delimited by its height cuts ("découpes de hauteur").
//
// A height cut does not open the surface: it draws a trace on it — a closed
// shape or an open line running from border to border — and the faces the
// traces delimit get an altitude delta relative to the main face.
//
// contour: [{x, y, type?}] ; holes: [[{x, y, type?}]] (the real cuts) ;
// traces: [{ id, points: [{x, y, type?}], closeLine?, delta?, side? }] — a
//   trace is closed unless closeLine === false. A closed trace carries the
//   delta of the face it encloses ;
// faceEntries: [{ id, seed: {x, y}, delta, side }] — delta of the face holding
//   the seed (faces delimited by open traces) ;
// scale: units → meters (the splitters' tolerances are metric).
//
// Returns [] when there is no trace, else every face of the partition:
// [{ key, points, holes, delta, side, heightCutId, faceEntryId, labelPoint,
//    area }] in the input units (points CCW, holes CW; `area` in units²).
// Delta of a face: the entry whose seed it holds, else the innermost closed
// trace around it, else 0.
export default function computeHeightFaces({
  contour,
  holes = [],
  traces = [],
  faceEntries = [],
  scale = 1,
  tolerance = 1e-3,
} = {}) {
  const validTraces = (traces || []).filter(
    (trace) => trace?.points?.length >= (isClosedTrace(trace) ? 3 : 2)
  );
  if (!validTraces.length || !(contour?.length >= 3)) return [];
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const toMeters = (points, closed) =>
    dedupe(
      expandArcsInPath(points, 6, closed).map((p) => ({
        x: p.x * k,
        y: p.y * k,
      })),
      closed
    );

  const contourM = toMeters(contour, true);
  const holesM = (holes || [])
    .map((hole) => toMeters(hole, true))
    .filter((hole) => hole.length >= 3);
  if (contourM.length < 3) return [];

  // The region as clean polygons (holes overlapping the border included).
  let pieces = regionToPieces(contourM, holesM);
  if (!pieces.length) return [];
  const regionLoops = [contourM, ...holesM];

  // 1. Closed traces: each piece is split in its inside / outside parts.
  for (const trace of validTraces) {
    if (!isClosedTrace(trace)) continue;
    const ring = toMeters(trace.points, true);
    if (ring.length < 3) continue;
    const clip = [[closeRing(ring.map((p) => [p.x, p.y]))]];
    const next = [];
    for (const piece of pieces) {
      const subject = pieceToMultiPolygon(piece);
      let inside;
      let outside;
      try {
        inside = polygonClipping.intersection(subject, clip);
        outside = polygonClipping.difference(subject, clip);
      } catch {
        next.push(piece);
        continue;
      }
      if (!inside.length) {
        next.push(piece);
        continue;
      }
      for (const p of multiPolygonToPieces(outside)) {
        next.push({ ...p, ringIds: piece.ringIds });
      }
      for (const p of multiPolygonToPieces(inside)) {
        next.push({ ...p, ringIds: [...piece.ringIds, trace.id] });
      }
    }
    pieces = next;
  }

  // 2. Open traces: prolonged to the border of the region, then drawn on
  // every piece they cross.
  for (const trace of validTraces) {
    if (isClosedTrace(trace)) continue;
    const path = extendPathEnds(regionLoops, toMeters(trace.points, false), {
      tolerance,
    });
    if (path.length < 2) continue;
    const next = [];
    for (const piece of pieces) {
      const loops = [piece.contour, ...piece.holes];
      const result = getPathChunksInRegion(loops, path, { tolerance });
      const split = result?.chunks?.length
        ? splitFlatRegionAlongChunks(loops, result.chunks)
        : null;
      if (!split) {
        next.push(piece);
        continue;
      }
      for (const face of split.faces) {
        const toLoop = (indices) => indices.map((i) => split.vertices[i]);
        next.push(
          orientPiece({
            contour: toLoop(face.loop),
            holes: (face.holes || []).map(toLoop),
            ringIds: piece.ringIds,
          })
        );
      }
    }
    pieces = next;
  }

  insertTJunctionVertices(pieces, tolerance);

  // 3. Deltas.
  const traceById = new Map(validTraces.map((trace) => [trace.id, trace]));
  const seeds = (faceEntries || [])
    .filter((e) => Number.isFinite(e?.seed?.x) && Number.isFinite(e?.seed?.y))
    .map((e) => ({ entry: e, x: e.seed.x * k, y: e.seed.y * k }));
  const usedEntryIds = new Set();
  const keyCounts = new Map();

  return pieces.map((piece, index) => {
    const loops = [piece.contour, ...piece.holes];
    const seed = seeds.find(
      (s) => !usedEntryIds.has(s.entry.id) && isInsideRegion(loops, s)
    );
    const ringId = piece.ringIds[piece.ringIds.length - 1] ?? null;
    const ring = ringId != null ? traceById.get(ringId) : null;

    let delta = 0;
    let side = HEIGHT_CUT_SIDE_TOP;
    let baseKey = `M:${index}`;
    if (seed) {
      usedEntryIds.add(seed.entry.id);
      delta = toNumber(seed.entry.delta);
      side = seed.entry.side ?? HEIGHT_CUT_SIDE_TOP;
      baseKey = `F:${seed.entry.id}`;
    } else if (ring) {
      delta = toNumber(ring.delta);
      side = ring.side ?? HEIGHT_CUT_SIDE_TOP;
      baseKey = `C:${ringId}`;
    }
    const count = keyCounts.get(baseKey) ?? 0;
    keyCounts.set(baseKey, count + 1);

    const labelPoint = getInteriorPoint(piece.contour, piece.holes);
    const fromMeters = (p) => ({ x: p.x / k, y: p.y / k });
    let area = Math.abs(signedArea2d(piece.contour));
    for (const hole of piece.holes) area -= Math.abs(signedArea2d(hole));

    return {
      key: count ? `${baseKey}:${count}` : baseKey,
      points: piece.contour.map(fromMeters),
      holes: piece.holes.map((hole) => hole.map(fromMeters)),
      delta,
      side,
      heightCutId: ringId,
      faceEntryId: seed?.entry.id ?? null,
      labelPoint: fromMeters(labelPoint),
      area: Math.max(0, area) / (k * k),
    };
  });
}

export function isClosedTrace(trace) {
  return trace?.closeLine !== false;
}

// A point strictly inside the polygon, as central as cheaply possible: the
// area centroid when it is inside, else the middle of the widest span of a
// horizontal scan line.
export function getInteriorPoint(contour, holes = []) {
  const loops = [contour, ...holes];
  const centroid = areaCentroid(contour, holes);
  if (centroid && isInsideRegion(loops, centroid)) return centroid;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of contour) {
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  let best = null;
  const steps = 9;
  for (let s = 1; s <= steps; s++) {
    const y = yMin + ((yMax - yMin) * s) / (steps + 1);
    const xs = [];
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        if (a.y > y === b.y > y) continue;
        xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    xs.sort((x1, x2) => x1 - x2);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const width = xs[i + 1] - xs[i];
      if (!best || width > best.width) {
        best = { width, x: (xs[i] + xs[i + 1]) / 2, y };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : (centroid ?? contour[0]);
}

// --- helpers

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dedupe(points, closed) {
  const out = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 1e-9) continue;
    out.push(p);
  }
  if (closed && out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 1e-9) out.pop();
  }
  return out;
}

function closeRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}

function openRing(ring) {
  const loop = ring.map(([x, y]) => ({ x, y }));
  if (loop.length > 1) {
    const first = loop[0];
    const last = loop[loop.length - 1];
    if (first.x === last.x && first.y === last.y) loop.pop();
  }
  return loop;
}

function orientPiece(piece) {
  const contour =
    signedArea2d(piece.contour) < 0
      ? [...piece.contour].reverse()
      : piece.contour;
  const holes = piece.holes.map((hole) =>
    signedArea2d(hole) > 0 ? [...hole].reverse() : hole
  );
  return { ...piece, contour, holes };
}

function pieceToMultiPolygon(piece) {
  return [
    [piece.contour, ...piece.holes].map((loop) =>
      closeRing(loop.map((p) => [p.x, p.y]))
    ),
  ];
}

function multiPolygonToPieces(multiPolygon) {
  const pieces = [];
  for (const polygon of multiPolygon || []) {
    const contour = openRing(polygon[0] || []);
    if (contour.length < 3 || Math.abs(signedArea2d(contour)) < 1e-9) continue;
    const holes = polygon
      .slice(1)
      .map(openRing)
      .filter((hole) => hole.length >= 3);
    pieces.push(orientPiece({ contour, holes, ringIds: [] }));
  }
  return pieces;
}

function regionToPieces(contour, holes) {
  const subject = [[closeRing(contour.map((p) => [p.x, p.y]))]];
  if (!holes.length) return multiPolygonToPieces(subject);
  try {
    const clip = holes.map((hole) => [closeRing(hole.map((p) => [p.x, p.y]))]);
    return multiPolygonToPieces(
      polygonClipping.difference(subject, ...clip)
    );
  } catch {
    return multiPolygonToPieces(subject);
  }
}

// Two faces sharing a border must share its vertices (the 3D build matches
// their edges to raise the step between them): every vertex lying on the
// edge of another ring is inserted in that edge.
function insertTJunctionVertices(pieces, tolerance) {
  const vertices = [];
  for (const piece of pieces) {
    for (const loop of [piece.contour, ...piece.holes]) vertices.push(...loop);
  }
  const fix = (loop) => {
    const out = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      out.push(a);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const len = Math.sqrt(len2);
      const inserted = [];
      for (const v of vertices) {
        const t = ((v.x - a.x) * dx + (v.y - a.y) * dy) / len2;
        if (t * len <= tolerance || (1 - t) * len <= tolerance) continue;
        const d = Math.hypot(v.x - (a.x + t * dx), v.y - (a.y + t * dy));
        if (d > tolerance) continue;
        if (inserted.some((e) => Math.abs(e.t - t) * len <= tolerance)) {
          continue;
        }
        inserted.push({ t, x: v.x, y: v.y });
      }
      inserted.sort((e1, e2) => e1.t - e2.t);
      for (const e of inserted) out.push({ x: e.x, y: e.y });
    }
    return out;
  };
  for (const piece of pieces) {
    piece.contour = fix(piece.contour);
    piece.holes = piece.holes.map(fix);
  }
}

function areaCentroid(contour, holes) {
  let weight = 0;
  let x = 0;
  let y = 0;
  for (const loop of [contour, ...holes]) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const cross = a.x * b.y - b.x * a.y;
      weight += cross;
      x += (a.x + b.x) * cross;
      y += (a.y + b.y) * cross;
    }
  }
  if (Math.abs(weight) < 1e-12) return null;
  return { x: x / (3 * weight), y: y / (3 * weight) };
}
