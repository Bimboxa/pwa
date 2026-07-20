// Splits a polyline (open or closed) into chains alternating inside/outside a
// CLOSED contour, handling MULTIPLE crossings (unlike splitPolylineByPolyline
// which only splits at the first intersection).
//
// Works in a single coordinate space (caller resolves everything to pixels).
// Arc control points must be expanded by the caller (expandArcsInPath) BEFORE
// calling — this util treats the path as straight segments.
//
// Returns null when the polyline never crosses the contour. Otherwise:
//   {
//     chains: [{
//       points,     // [{x, y, id?}] — original vertices keep their id,
//                   // crossing points are new (no id); consecutive chains
//                   // SHARE their crossing point object
//       inside,     // true when the chain lies inside the contour
//       srcSegIdx,  // source segment index of each chain segment
//                   // (srcSegIdx.length === points.length - 1)
//     }]
//   }

function segmentIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return null; // parallel

  const dpx = p3.x - p1.x;
  const dpy = p3.y - p1.y;

  const t = (dpx * d2y - dpy * d2x) / cross;
  const u = (dpx * d1y - dpy * d1x) / cross;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * d1x, y: p1.y + t * d1y, t };
  }
  return null;
}

function pointInRing(point, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x,
      yi = ring[i].y;
    const xj = ring[j].x,
      yj = ring[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const EPS_T = 1e-6;

export default function splitPolylineByClosedContour(
  polyPoints,
  contourRing,
  { closed = false } = {}
) {
  if (!polyPoints || polyPoints.length < 2) return null;
  if (!contourRing || contourRing.length < 3) return null;

  // contour edges (ring closes on itself)
  const contourEdges = [];
  for (let i = 0; i < contourRing.length; i++) {
    contourEdges.push([
      contourRing[i],
      contourRing[(i + 1) % contourRing.length],
    ]);
  }

  // 1. expanded vertex list: original vertices + crossing vertices inserted in
  // order along each segment. Entries: {point, isCrossing, srcSegIdx}.
  const nSegs = closed ? polyPoints.length : polyPoints.length - 1;
  const entries = [];
  let crossingsCount = 0;

  for (let i = 0; i < nSegs; i++) {
    const a = polyPoints[i];
    const b = polyPoints[(i + 1) % polyPoints.length];
    entries.push({ point: a, isCrossing: false, srcSegIdx: i });

    const hits = [];
    for (const [c, d] of contourEdges) {
      const inter = segmentIntersection(a, b, c, d);
      // crossings landing exactly on a vertex are skipped (the vertex itself
      // already separates the chains well enough for classification)
      if (inter && inter.t > EPS_T && inter.t < 1 - EPS_T) hits.push(inter);
    }
    hits.sort((h1, h2) => h1.t - h2.t);
    // dedupe crossings at the same param (contour corner hit)
    let lastT = -1;
    for (const h of hits) {
      if (h.t - lastT < EPS_T) continue;
      lastT = h.t;
      entries.push({
        point: { x: h.x, y: h.y },
        isCrossing: true,
        srcSegIdx: i,
      });
      crossingsCount++;
    }
  }
  if (!closed) {
    entries.push({
      point: polyPoints[polyPoints.length - 1],
      isCrossing: false,
      srcSegIdx: nSegs - 1,
    });
  }

  if (crossingsCount === 0) return null;

  // 2. closed polyline: rotate so the list starts at a crossing, then treat it
  // as an open sequence that wraps (the first crossing point is repeated at
  // the end so the last chain closes on it).
  let seq = entries;
  if (closed) {
    const firstCrossing = entries.findIndex((e) => e.isCrossing);
    seq = [...entries.slice(firstCrossing), ...entries.slice(0, firstCrossing)];
    seq.push(seq[0]);
  }

  // 3. cut into chains at crossing vertices (crossing shared between chains)
  const chains = [];
  let current = null;
  for (let k = 0; k < seq.length; k++) {
    const e = seq[k];
    if (!current) {
      current = { entries: [e] };
      continue;
    }
    current.entries.push(e);
    if (e.isCrossing && k < seq.length - 1) {
      chains.push(current);
      current = { entries: [e] };
    }
  }
  if (current && current.entries.length >= 2) chains.push(current);

  // 4. classify + shape the result. Degenerate chains (zero length) dropped.
  const result = [];
  for (const chain of chains) {
    const pts = chain.entries.map((e) => e.point);
    let length = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      length += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    if (length < 1e-6) continue;

    // classification point: midpoint of the chain's longest segment
    let bestIdx = 0;
    let bestLen = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (l > bestLen) {
        bestLen = l;
        bestIdx = i;
      }
    }
    const mid = {
      x: (pts[bestIdx].x + pts[bestIdx + 1].x) / 2,
      y: (pts[bestIdx].y + pts[bestIdx + 1].y) / 2,
    };

    result.push({
      points: pts,
      inside: pointInRing(mid, contourRing),
      srcSegIdx: chain.entries.slice(0, -1).map((e) => e.srcSegIdx),
    });
  }

  if (result.length < 2) return null;

  return { chains: result };
}
