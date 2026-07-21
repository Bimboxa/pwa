// Turns the shared-edge chains found by findSharedEdgeChains into vertical
// wall chains. At each chain point the wall spans from the top of the lower
// surface to the top of the higher surface:
//   top(annotation, P) = (offsetZ ?? 0) + (height ?? 0) + surfaceZ(P)
// where surfaceZ is the per-vertex resolved offsetTop (ramp-derived for
// sloped surfaces) — EXCEPT for stairs annotations (guideLine isStairs),
// which opt out of the resolve-time ramp: their stepped surface is sampled
// here with the same conventions as getGuideLineStairsLayout (tread i spans
// arc [i·L/N, (i+1)·L/N] from the LOW end at z = (i+1)·riserH, approach
// floor z = 0 before the first nosing, top landing beyond the guide end).
// Chains are subdivided at each nosing with DUPLICATED points (same x/y, one
// z per side) so the wall bottom/top follows the steps with exactly vertical
// risers. Stairs guide lines are read as straight polylines (arcs in stairs
// guides are not sampled here).
//
// Where the two tops cross along a chain, the zero-crossing point is inserted
// so per-vertex min/max stays exact. Flush portions (span <= minSpanM at both
// segment ends) are dropped, splitting the chain into visible sub-chains.
//
// Returns [{ neighbor, pointRefs: [{x, y, offsetBottom, offsetTop}] }]
// (pixels + meters, >= 2 points per chain).

function nearestSegmentProjection(p, segments, maxDistPx) {
  const maxDistSq = maxDistPx * maxDistPx;
  let best = null;
  for (const [c, d] of segments) {
    const abx = d.x - c.x;
    const aby = d.y - c.y;
    const lenSq = abx * abx + aby * aby;
    let t = 0;
    if (lenSq > 0) {
      t = ((p.x - c.x) * abx + (p.y - c.y) * aby) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const dx = p.x - (c.x + t * abx);
    const dy = p.y - (c.y + t * aby);
    const distSq = dx * dx + dy * dy;
    if (distSq <= maxDistSq && (!best || distSq < best.distSq)) {
      best = { distSq, c, d, t };
    }
  }
  return best;
}

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

// ─── stairs sampler (conventions of getGuideLineStairsLayout) ───────────────

function makeStairsSampler(annotation, meterByPx) {
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  const guideLine = (annotation?.guideLines ?? []).find(
    (g) => g?.isStairs && (g?.points?.length ?? 0) >= 2
  );
  if (!guideLine) return null;

  const slopePct = Number(guideLine.slopePct) || 0;
  let spine = guideLine.points.filter(
    (p) => typeof p?.x === "number" && typeof p?.y === "number"
  );
  if (spine.length < 2) return null;
  // low end = drawing start when slopePct >= 0 (same rule as the layout)
  if (slopePct < 0) spine = spine.slice().reverse();

  const cum = [0];
  for (let i = 0; i < spine.length - 1; i += 1) {
    cum.push(
      cum[i] +
        Math.hypot(spine[i + 1].x - spine[i].x, spine[i + 1].y - spine[i].y)
    );
  }
  const L2D = cum[cum.length - 1];
  if (!Number.isFinite(L2D) || L2D < 1e-6) return null;

  const count = Math.max(1, Math.round(Number(guideLine.stairsCount) || 1));
  const riserH = ((Math.abs(slopePct) / 100) * L2D * meterByPx) / count;
  const step = L2D / count;
  // discontinuities: nosing i at s = i·L/N (i = 0..N-1)
  const jumps = [];
  for (let i = 0; i < count; i += 1) jumps.push(i * step);
  // side-selection epsilon: lands the evaluation inside the right tread
  const epsS = Math.min(step / 1000, 0.01);

  // arc-length parameter of the projection of p onto the spine (clamped)
  const sOf = (p) => {
    let best = null;
    for (let i = 0; i < spine.length - 1; i += 1) {
      const a = spine[i];
      const b = spine[i + 1];
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
      const distSq = dx * dx + dy * dy;
      if (!best || distSq < best.distSq) {
        best = { distSq, s: cum[i] + t * Math.sqrt(lenSq) };
      }
    }
    return best.s;
  };

  // stepped surface height at arc position s (meters, 0 = approach floor)
  const zAt = (s) => {
    if (s <= 0) return 0;
    const idx = Math.min(Math.floor(s / step), count - 1);
    return (idx + 1) * riserH;
  };

  return { sOf, zAt, jumps, epsS };
}

// Subdivides the node list at the stairs nosings crossed by each segment,
// duplicating the crossing point (one node per side) so the wall follows the
// steps with vertical risers. Attaches node[key] = the arc position to
// evaluate zAt with (nudged inside the segment when a node sits exactly on a
// nosing). `offsetTop` is lerped onto inserted nodes for the other side.
function subdivideAtStairsJumps(nodes, sampler, key) {
  const { sOf, jumps, epsS } = sampler;

  const nudge = (s, dir) => {
    if (dir === 0) return s;
    for (const j of jumps) {
      if (Math.abs(s - j) <= epsS) return j + Math.sign(dir) * epsS;
    }
    return s;
  };

  const out = [];
  const pushNode = (node) => {
    const last = out[out.length - 1];
    if (
      last &&
      last.x === node.x &&
      last.y === node.y &&
      last[key] === node[key] &&
      (last.offsetTop ?? 0) === (node.offsetTop ?? 0)
    )
      return; // collapse identical duplicates at segment junctions
    out.push(node);
  };

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const A = nodes[i];
    const B = nodes[i + 1];
    const sA = sOf(A);
    const sB = sOf(B);
    const d = sB - sA;

    pushNode({ ...A, [key]: nudge(sA, d) });

    if (Math.abs(d) > 2 * epsS) {
      const lo = Math.min(sA, sB);
      const hi = Math.max(sA, sB);
      const crossed = jumps
        .filter((j) => j > lo + epsS && j < hi - epsS)
        .sort((j1, j2) => (d > 0 ? j1 - j2 : j2 - j1));
      for (const j of crossed) {
        const t = (j - sA) / d;
        const P = {
          x: A.x + t * (B.x - A.x),
          y: A.y + t * (B.y - A.y),
          offsetTop:
            (A.offsetTop ?? 0) + t * ((B.offsetTop ?? 0) - (A.offsetTop ?? 0)),
        };
        pushNode({ ...P, [key]: j - Math.sign(d) * epsS });
        pushNode({ ...P, [key]: j + Math.sign(d) * epsS });
      }
    }

    pushNode({ ...B, [key]: nudge(sB, -d) });
  }
  return out;
}

// ─── main ───────────────────────────────────────────────────────────────────

export default function computeAutoWallChains({
  selectedAnnotation,
  sharedChains,
  thresholdPx,
  meterByPx,
  minSpanM = 0.001,
}) {
  const selBase =
    (selectedAnnotation?.offsetZ ?? 0) + (selectedAnnotation?.height ?? 0);
  const selSampler = makeStairsSampler(selectedAnnotation, meterByPx);

  const wallChains = [];

  for (const { neighbor, neighborRings, chain } of sharedChains ?? []) {
    const nbBase = (neighbor?.offsetZ ?? 0) + (neighbor?.height ?? 0);
    const nbSampler = makeStairsSampler(neighbor, meterByPx);
    const segments = (neighborRings ?? []).flatMap(ringSegments);
    if (!segments.length) continue;

    // 0. subdivide the chain at the stairs nosings of either side
    let nodes = chain.map((p) => ({
      x: p.x,
      y: p.y,
      offsetTop: p.offsetTop ?? 0,
    }));
    if (selSampler) nodes = subdivideAtStairsJumps(nodes, selSampler, "sS");
    if (nbSampler) nodes = subdivideAtStairsJumps(nodes, nbSampler, "sN");
    if (nodes.length < 2) continue;

    // 1. tops on both sides at each node
    const pts = [];
    for (const p of nodes) {
      const tS = selSampler
        ? selBase + selSampler.zAt(p.sS ?? selSampler.sOf(p))
        : selBase + (p.offsetTop ?? 0);

      let tN;
      if (nbSampler) {
        tN = nbBase + nbSampler.zAt(p.sN ?? nbSampler.sOf(p));
      } else {
        const proj = nearestSegmentProjection(p, segments, 3 * thresholdPx);
        if (proj) {
          tN =
            nbBase +
            (proj.c.offsetTop ?? 0) +
            proj.t * ((proj.d.offsetTop ?? 0) - (proj.c.offsetTop ?? 0));
        } else if (pts.length) {
          tN = pts[pts.length - 1].tN;
        } else {
          continue; // degenerate leading point with no neighbor edge in range
        }
      }
      pts.push({ x: p.x, y: p.y, tS, tN });
    }
    if (pts.length < 2) continue;

    // 2. insert zero-crossings where the two tops cross
    const withCrossings = [pts[0]];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const spanA = a.tS - a.tN;
      const spanB = b.tS - b.tN;
      if ((spanA > 0 && spanB < 0) || (spanA < 0 && spanB > 0)) {
        const f = spanA / (spanA - spanB);
        withCrossings.push({
          x: a.x + f * (b.x - a.x),
          y: a.y + f * (b.y - a.y),
          tS: a.tS + f * (b.tS - a.tS),
          tN: a.tN + f * (b.tN - a.tN),
        });
      }
      withCrossings.push(b);
    }

    // 3. split into visible sub-chains (drop flush portions)
    let current = null;
    const flush = () => {
      if (current && current.length >= 2) {
        wallChains.push({
          neighbor,
          pointRefs: current.map((p) => ({
            x: p.x,
            y: p.y,
            offsetBottom: Math.min(p.tS, p.tN),
            offsetTop: Math.max(p.tS, p.tN),
          })),
        });
      }
      current = null;
    };
    for (let i = 1; i < withCrossings.length; i += 1) {
      const a = withCrossings[i - 1];
      const b = withCrossings[i];
      const visible =
        Math.max(Math.abs(a.tS - a.tN), Math.abs(b.tS - b.tN)) > minSpanM;
      if (visible) {
        if (!current) current = [a];
        current.push(b);
      } else {
        flush();
      }
    }
    flush();
  }

  return wallChains;
}
