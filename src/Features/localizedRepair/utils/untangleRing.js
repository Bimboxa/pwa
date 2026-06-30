import isSimpleRing from "./isSimpleRing";

// Untangle a self-crossing closed pixel-space ring into its constituent simple
// loops, localized to the repair rectangle.
//
// A wall contour traced as a single closed POLYLINE can encode two strips that
// cross at a junction, so the outline self-intersects. The two strips are joined
// by two "bridge" edges; severing them and re-closing each chain yields the two
// clean (slightly overlapping) strips. The repair rectangle picks which junction
// to resolve: the bridges are sought among the edges that cross the rectangle.
//
// Input: ring as [{x,y}] (no repeated closing point), rect as {x,y,width,height}.
// Output: array of simple loops ([[{x,y}], ...]) sorted by area descending, or
// null when no valid untangling is found (caller keeps the ring as-is).

const MIN_LOOP_AREA = 4; // px² — drop degenerate sliver loops

function ringArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function pointInRect(p, r) {
  return (
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
  );
}

function segmentsCross(p1, p2, p3, p4) {
  const d = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(d) < 1e-12) return false;
  const ua =
    ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
  const ub =
    ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Does edge a→b touch the rectangle (endpoint inside, or crosses a rect side)?
function edgeHitsRect(a, b, r) {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const c = [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
  for (let k = 0; k < 4; k++) {
    if (segmentsCross(a, b, c[k], c[(k + 1) % 4])) return true;
  }
  return false;
}

// Remove the given edge indices (edge e = vertex e → vertex e+1) from the cyclic
// vertex list and return the resulting open chains as arrays of {x,y}.
function chainsAfterCut(ring, cutEdges) {
  const n = ring.length;
  const cut = new Set(cutEdges);
  // Start each chain right after a cut, walk until the next cut.
  const chains = [];
  for (const e of cut) {
    const start = (e + 1) % n;
    const chain = [];
    let k = start;
    for (let step = 0; step < n; step++) {
      chain.push({ x: ring[k].x, y: ring[k].y });
      if (cut.has(k)) break; // edge k → k+1 is cut: stop after pushing vertex k
      k = (k + 1) % n;
    }
    if (chain.length >= 3) chains.push(chain);
  }
  return chains;
}

// All combinations of `k` items from `arr`.
function combinations(arr, k) {
  const out = [];
  const rec = (start, combo) => {
    if (combo.length === k) {
      out.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1, combo);
      combo.pop();
    }
  };
  rec(0, []);
  return out;
}

export default function untangleRing(ring, rect) {
  if (!ring || ring.length < 4 || !rect) return null;
  if (isSimpleRing(ring)) return null; // nothing tangled

  const n = ring.length;

  // Candidate bridge edges: contour edges that touch the repair rectangle.
  const candidates = [];
  for (let e = 0; e < n; e++) {
    if (edgeHitsRect(ring[e], ring[(e + 1) % n], rect)) candidates.push(e);
  }
  if (candidates.length < 2) return null;

  // Try severing pairs (then triples): keep the severing whose loops are ALL
  // simple and non-degenerate, maximizing the smallest loop area.
  let best = null;
  for (let k = 2; k <= Math.min(4, candidates.length); k++) {
    for (const combo of combinations(candidates, k)) {
      const chains = chainsAfterCut(ring, combo);
      if (chains.length < 2) continue;
      let ok = true;
      let minArea = Infinity;
      for (const c of chains) {
        const area = ringArea(c);
        if (area < MIN_LOOP_AREA || !isSimpleRing(c)) {
          ok = false;
          break;
        }
        if (area < minArea) minArea = area;
      }
      if (ok && (!best || minArea > best.minArea)) {
        best = { chains, minArea };
      }
    }
    if (best) break; // prefer the fewest cuts
  }
  if (!best) return null;

  return best.chains.sort((a, b) => ringArea(b) - ringArea(a));
}
