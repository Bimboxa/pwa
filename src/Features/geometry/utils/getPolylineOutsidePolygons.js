// Clips a polyline (open or closed) by a set of polygons: keeps the chains of
// the polyline lying OUTSIDE every polygon — « Évider » of a line, the
// polygons being the footprints of the annotations drawn over it.
//
// Works in a single coordinate space (caller resolves everything to pixels).
// Arc control points must be expanded by the caller BEFORE calling — the path
// is treated as straight segments.
//
// `multiPolygon` uses the polygon-clipping format ([polygon][ring][x, y]),
// typically the UNION of the footprints: polygons are disjoint, so a point is
// inside when it lies in an odd number of rings (holes included).
//
// Unlike splitPolylineByClosedContour, every elementary piece between two
// consecutive crossings is classified on its own midpoint, so a crossing
// landing exactly on a vertex of the polyline still separates the chains.
//
// Returns null when nothing is removed. Otherwise:
//   {
//     chains: [{
//       points,     // original vertices are passed through (same objects,
//                   // they keep their id); cut points are new:
//                   // {x, y, srcSegIdx, t} — t in ]0, 1[ along the source
//                   // segment
//       srcSegIdx,  // source segment index of each chain segment
//                   // (srcSegIdx.length === points.length - 1)
//     }],
//     consumed,     // true when no chain is left
//   }
// Chains are always OPEN, in the order of the path.

const EPS_T = 1e-9;
// Inside runs shorter than this are numeric noise (corner grazing).
const MIN_INSIDE_LENGTH = 1e-6;
// Chains shorter than this are slivers left between two footprints.
const MIN_CHAIN_LENGTH = 0.5;

function segmentIntersectionT(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4[0] - p3[0];
  const d2y = p4[1] - p3[1];

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return null; // parallel

  const dpx = p3[0] - p1.x;
  const dpy = p3[1] - p1.y;

  const t = (dpx * d2y - dpy * d2x) / cross;
  const u = (dpx * d1y - dpy * d1x) / cross;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export default function getPolylineOutsidePolygons(
  points,
  multiPolygon,
  { closed = false } = {}
) {
  if (!points || points.length < 2) return null;

  const rings = (multiPolygon ?? [])
    .flat()
    .filter((ring) => ring && ring.length >= 3);
  if (rings.length === 0) return null;

  const isInside = (x, y) => {
    let count = 0;
    for (const ring of rings) if (pointInRing(x, y, ring)) count++;
    return count % 2 === 1;
  };

  // 1. elementary pieces: each source segment split at its crossings with
  // the ring edges, classified by its midpoint.
  const nSegs = closed ? points.length : points.length - 1;
  const pieces = []; // {start, end, srcSegIdx, inside}
  for (let i = 0; i < nSegs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];

    const ts = [];
    for (const ring of rings) {
      for (let k = 0; k < ring.length; k++) {
        const c = ring[k];
        const d = ring[(k + 1) % ring.length];
        if (c[0] === d[0] && c[1] === d[1]) continue; // closing duplicate
        const t = segmentIntersectionT(a, b, c, d);
        if (t != null && t > EPS_T && t < 1 - EPS_T) ts.push(t);
      }
    }
    ts.sort((t1, t2) => t1 - t2);

    let prevT = 0;
    let prevNode = a;
    const pushPiece = (t, node) => {
      const tm = (prevT + t) / 2;
      pieces.push({
        start: prevNode,
        end: node,
        srcSegIdx: i,
        inside: isInside(a.x + tm * (b.x - a.x), a.y + tm * (b.y - a.y)),
      });
      prevT = t;
      prevNode = node;
    };
    for (const t of ts) {
      if (t - prevT < EPS_T) continue; // same crossing (footprint corner)
      pushPiece(t, {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
        srcSegIdx: i,
        t,
      });
    }
    pushPiece(1, b);
  }

  // Corner grazing: an inside run with no length removes nothing.
  for (const piece of pieces) {
    if (piece.inside && dist(piece.start, piece.end) < MIN_INSIDE_LENGTH) {
      piece.inside = false;
    }
  }
  if (!pieces.some((piece) => piece.inside)) return null;

  // 2. consecutive outside pieces → chains
  const chains = [];
  let current = null;
  for (const piece of pieces) {
    if (piece.inside) {
      current = null;
      continue;
    }
    if (!current) {
      current = { points: [piece.start], srcSegIdx: [] };
      chains.push(current);
    } else if (current.points[current.points.length - 1].t != null) {
      // two outside pieces of the same source segment meeting on a cut
      // point: no vertex there
      current.points.pop();
      current.srcSegIdx.pop();
    }
    current.points.push(piece.end);
    current.srcSegIdx.push(piece.srcSegIdx);
  }

  // 3. closed path: the chain running through the first vertex is one chain
  if (
    closed &&
    chains.length >= 2 &&
    !pieces[0].inside &&
    !pieces[pieces.length - 1].inside
  ) {
    const first = chains.shift();
    const last = chains[chains.length - 1];
    last.points.push(...first.points.slice(1));
    last.srcSegIdx.push(...first.srcSegIdx);
  }

  const kept = chains.filter((chain) => {
    let length = 0;
    for (let i = 0; i < chain.points.length - 1; i++) {
      length += dist(chain.points[i], chain.points[i + 1]);
    }
    return length >= MIN_CHAIN_LENGTH;
  });

  return { chains: kept, consumed: kept.length === 0 };
}
