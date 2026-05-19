// Splits a closed polygon ring into the two "rail" chains of a ramp.
//
// A ramp is bounded by two designated edges: the ISO edge (constant height,
// contour line) and the MOVED edge (the one whose altimetry is being changed).
// Removing those two edges from the cycle leaves exactly two vertex chains —
// the ramp's sides. Each chain is returned oriented ISO-end → MOVED-end so the
// caller can parametrize it from t=0 (iso) to t=1 (moved).
//
// `ring` is the ordered list of polygon points: [{ id, x, y }, ...]. Segment i
// connects ring[i] → ring[(i+1) % N] (same convention as hiddenSegmentsIdx).
//
// Returns { isoIds:[a0,a1], movedIds:[b0,b1], railA:[ids…], railB:[ids…] } or
// null when the configuration is degenerate (iso === moved, the two edges
// share a vertex, or the ring is too small).
export default function getRampRailChains({ ring, isoSegIdx, movedSegIdx }) {
  if (!Array.isArray(ring)) return null;
  const N = ring.length;
  if (N < 4) return null;
  if (!Number.isInteger(isoSegIdx) || !Number.isInteger(movedSegIdx)) {
    return null;
  }
  if (isoSegIdx < 0 || isoSegIdx >= N || movedSegIdx < 0 || movedSegIdx >= N) {
    return null;
  }
  if (isoSegIdx === movedSegIdx) return null;

  const a0 = isoSegIdx;
  const a1 = (isoSegIdx + 1) % N;
  const b0 = movedSegIdx;
  const b1 = (movedSegIdx + 1) % N;

  // The two edges may not share an endpoint (adjacent segments) — that would
  // collapse a rail to a single point.
  const isoSet = new Set([a0, a1]);
  if (isoSet.has(b0) || isoSet.has(b1)) return null;

  // railA: forward from a1 (iso) until b0 (moved), inclusive.
  const railA = [];
  for (let v = a1; ; v = (v + 1) % N) {
    railA.push(ring[v].id);
    if (v === b0) break;
    if (v === a0) return null; // wrapped without hitting the moved edge
  }

  // railB raw: forward from b1 (moved) until a0 (iso), inclusive. Reverse it so
  // it is oriented iso-end → moved-end like railA.
  const railBRaw = [];
  for (let v = b1; ; v = (v + 1) % N) {
    railBRaw.push(ring[v].id);
    if (v === a0) break;
    if (v === b0) return null;
  }
  const railB = railBRaw.slice().reverse();

  if (railA.length < 2 || railB.length < 2) return null;

  return {
    isoIds: [ring[a0].id, ring[a1].id],
    movedIds: [ring[b0].id, ring[b1].id],
    railA, // [iso … moved]
    railB, // [iso … moved]
  };
}
