// Is a closed pixel-space ring simple (no self-intersection)?
//
// Brute-force O(n²) edge-pair test — rings here are tiny (≤~20 pts). Adjacent
// edges (sharing a vertex) and the wrap-around pair are skipped; only proper
// crossings of non-adjacent edges count. Returns false on a real crossing.

function onSegment(px, py, ax, ay, bx, by) {
  return (
    Math.min(ax, bx) - 1e-9 <= px &&
    px <= Math.max(ax, bx) + 1e-9 &&
    Math.min(ay, by) - 1e-9 <= py &&
    py <= Math.max(ay, by) + 1e-9
  );
}

function cross(ox, oy, ax, ay, bx, by) {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

// Do segments p1p2 and p3p4 properly intersect?
function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(p3.x, p3.y, p4.x, p4.y, p1.x, p1.y);
  const d2 = cross(p3.x, p3.y, p4.x, p4.y, p2.x, p2.y);
  const d3 = cross(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  const d4 = cross(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  // Collinear overlap cases.
  if (d1 === 0 && onSegment(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y)) return true;
  if (d2 === 0 && onSegment(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y)) return true;
  if (d3 === 0 && onSegment(p3.x, p3.y, p1.x, p1.y, p2.x, p2.y)) return true;
  if (d4 === 0 && onSegment(p4.x, p4.y, p1.x, p1.y, p2.x, p2.y)) return true;
  return false;
}

export default function isSimpleRing(ring) {
  if (!ring || ring.length < 3) return false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges (share a vertex) and the wrap-around pair.
      if (j === i) continue;
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}
