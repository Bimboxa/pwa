// Finds the portions of a selected annotation's boundary shared with the
// boundaries of neighbor annotations. Works at edge-portion (interval) level,
// not per-vertex, so a neighbor touching only the middle of one long selected
// edge produces a correct sub-chain with interpolated endpoints.
//
// Adjacency per source edge [A, B]:
//   - id fast-path: the neighbor has an edge whose two point ids are A.id/B.id
//     (shared db.points ids) → the full edge is shared;
//   - geometric fallback: a neighbor segment projects onto [A, B] with an
//     overlap longer than thresholdPx while staying within thresholdPx of it
//     (checked at both interval ends + midpoint to reject corner crossings).
// Intervals are merged per edge, then stitched across consecutive edges
// (wrap-around included for closed rings) into maximal chains.
//
// Inputs (all pixel-space, rings from buildAnnotationEdgeRings):
//   sourceRings: [{ kind, closed, points }]
//   neighbors:   [{ annotation, rings }]
//   thresholdPx: adjacency tolerance in px
//   minChainLengthPx: chains shorter than this are dropped (corner slivers)
//
// Returns [{ neighbor, neighborRings, sourceRingIndex, chain }] with chain =
// [{ x, y, offsetTop, id? }] — ALL maximal chains, not just the longest.

function ringSegments(ring) {
  const pts = ring.points;
  const n = pts.length;
  const count = ring.closed ? n : n - 1;
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    segments.push([pts[i], pts[(i + 1) % n]]);
  }
  return segments;
}

function distSqToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = 0;
  if (lenSq > 0) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const dx = p.x - (a.x + t * abx);
  const dy = p.y - (a.y + t * aby);
  return dx * dx + dy * dy;
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    offsetTop:
      (a.offsetTop ?? 0) + t * ((b.offsetTop ?? 0) - (a.offsetTop ?? 0)),
  };
}

// Shared intervals [t0, t1] of edge [A, B] (t along AB), merged.
function getEdgeSharedIntervals({
  a,
  b,
  neighborSegments,
  idEdgeSet,
  thresholdPx,
}) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const len = Math.sqrt(lenSq);
  if (len < 1e-9) return [];

  const thresholdSq = thresholdPx * thresholdPx;
  const intervals = [];

  if (a.id && b.id && idEdgeSet.has(`${a.id}|${b.id}`)) {
    intervals.push([0, 1]);
  } else {
    for (const [c, d] of neighborSegments) {
      const tC = ((c.x - a.x) * abx + (c.y - a.y) * aby) / lenSq;
      const tD = ((d.x - a.x) * abx + (d.y - a.y) * aby) / lenSq;
      const t0 = Math.max(0, Math.min(tC, tD));
      const t1 = Math.min(1, Math.max(tC, tD));
      if ((t1 - t0) * len <= thresholdPx) continue;

      const pAt = (t) => ({ x: a.x + t * abx, y: a.y + t * aby });
      const near = (t) => distSqToSegment(pAt(t), c, d) <= thresholdSq;
      if (!near(t0) || !near(t1) || !near((t0 + t1) / 2)) continue;

      intervals.push([t0, t1]);
    }
  }

  if (intervals.length <= 1) return intervals;

  // merge overlapping intervals (or gaps below the tolerance)
  intervals.sort((i1, i2) => i1[0] - i2[0]);
  const gapT = thresholdPx / len;
  const merged = [intervals[0]];
  for (let k = 1; k < intervals.length; k += 1) {
    const last = merged[merged.length - 1];
    if (intervals[k][0] <= last[1] + gapT) {
      last[1] = Math.max(last[1], intervals[k][1]);
    } else {
      merged.push(intervals[k]);
    }
  }
  return merged;
}

function chainArcLength(chain) {
  let length = 0;
  for (let i = 1; i < chain.length; i += 1) {
    length += Math.hypot(
      chain[i].x - chain[i - 1].x,
      chain[i].y - chain[i - 1].y
    );
  }
  return length;
}

// Stitches per-edge shared intervals into maximal chains along the ring.
function stitchChains({ ring, intervalsByEdge, thresholdPx }) {
  const pts = ring.points;
  const n = pts.length;
  const edgeCount = ring.closed ? n : n - 1;

  const edgeLen = (i) => {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const epsT = (i) => {
    const len = edgeLen(i);
    return len > 0 ? Math.min(0.5, thresholdPx / len) : 0.5;
  };

  const startsAtZero = (i, itv) => itv[0] <= epsT(i);
  const endsAtOne = (i, itv) => itv[1] >= 1 - epsT(i);

  // (interval ending at t≈1 on edge i) chains to (interval starting at t≈0 on
  // edge i+1) — the continuing interval is always the FIRST of the next edge.
  const continuesFromPrev = (i) => {
    const prevIdx = i - 1 < 0 ? (ring.closed ? edgeCount - 1 : -1) : i - 1;
    if (prevIdx < 0) return false;
    const prev = intervalsByEdge[prevIdx];
    const curr = intervalsByEdge[i];
    if (!prev?.length || !curr?.length) return false;
    return (
      endsAtOne(prevIdx, prev[prev.length - 1]) && startsAtZero(i, curr[0])
    );
  };

  // fully covered closed ring → one closed chain (repeat the first point)
  if (
    ring.closed &&
    intervalsByEdge.every(
      (list, i) =>
        list.length === 1 && startsAtZero(i, list[0]) && endsAtOne(i, list[0])
    )
  ) {
    return [[...pts.map((p) => ({ ...p })), { ...pts[0] }]];
  }

  const chains = [];
  for (let i = 0; i < edgeCount; i += 1) {
    const list = intervalsByEdge[i];
    if (!list?.length) continue;
    for (let j = 0; j < list.length; j += 1) {
      // an interval is a chain start unless it is absorbed by the previous
      // edge's run
      if (j === 0 && continuesFromPrev(i)) continue;

      const chain = [];
      let edgeIdx = i;
      let itv = list[j];
      // visited (edge, interval-0) keys stop a wrap-around run from
      // re-consuming its own starting interval
      const visited = new Set([`${edgeIdx}:${j}`]);
      // start point: real vertex when the interval starts at the vertex
      const a0 = pts[edgeIdx];
      const b0 = pts[(edgeIdx + 1) % n];
      chain.push(
        startsAtZero(edgeIdx, itv) ? { ...a0 } : lerpPoint(a0, b0, itv[0])
      );

      for (;;) {
        const a = pts[edgeIdx];
        const b = pts[(edgeIdx + 1) % n];
        if (!endsAtOne(edgeIdx, itv)) {
          chain.push(lerpPoint(a, b, itv[1]));
          break;
        }
        const nextIdx =
          edgeIdx + 1 >= edgeCount ? (ring.closed ? 0 : -1) : edgeIdx + 1;
        const next = nextIdx >= 0 ? intervalsByEdge[nextIdx] : null;
        const canContinue =
          next?.length &&
          startsAtZero(nextIdx, next[0]) &&
          !visited.has(`${nextIdx}:0`);
        chain.push({ ...b });
        if (!canContinue) break;
        edgeIdx = nextIdx;
        itv = next[0];
        visited.add(`${edgeIdx}:0`);
      }

      if (chain.length >= 2) chains.push(chain);
    }
  }
  return chains;
}

export default function findSharedEdgeChains({
  sourceRings,
  neighbors,
  thresholdPx,
  minChainLengthPx,
}) {
  if (!thresholdPx || thresholdPx <= 0) return [];
  const minLen = minChainLengthPx ?? 2 * thresholdPx;

  const result = [];

  for (const { annotation: neighbor, rings: neighborRings } of neighbors ??
    []) {
    const neighborSegments = (neighborRings ?? []).flatMap(ringSegments);
    if (!neighborSegments.length) continue;

    const idEdgeSet = new Set();
    for (const [c, d] of neighborSegments) {
      if (c.id && d.id) {
        idEdgeSet.add(`${c.id}|${d.id}`);
        idEdgeSet.add(`${d.id}|${c.id}`);
      }
    }

    (sourceRings ?? []).forEach((ring, sourceRingIndex) => {
      const pts = ring.points;
      const n = pts.length;
      const edgeCount = ring.closed ? n : n - 1;
      if (edgeCount < 1) return;

      const intervalsByEdge = [];
      for (let i = 0; i < edgeCount; i += 1) {
        intervalsByEdge.push(
          getEdgeSharedIntervals({
            a: pts[i],
            b: pts[(i + 1) % n],
            neighborSegments,
            idEdgeSet,
            thresholdPx,
          })
        );
      }
      if (!intervalsByEdge.some((list) => list.length)) return;

      const chains = stitchChains({ ring, intervalsByEdge, thresholdPx });
      for (const chain of chains) {
        if (chainArcLength(chain) < minLen) continue;
        result.push({ neighbor, neighborRings, sourceRingIndex, chain });
      }
    });
  }

  return result;
}
