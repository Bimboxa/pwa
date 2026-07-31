// Offset each point of a (possibly arc-carrying) path along its local
// right-of-tangent normal by `distance`. The per-vertex normal uses the
// neighbour-to-neighbour tangent, which at an arc's circle-midpoint is the
// radial direction — so offsetting an S-C-S triplet yields a concentric arc
// and the curve stays smooth. `type` is preserved so the arc-aware path
// builder still recognises the S-C-S pattern (real arcs, not segments).
//
// Because every vertex uses the neighbour-to-neighbour tangent, the resulting
// chain stays JOINED at the corners (miter-like) instead of breaking into
// per-segment offsets — this is what keeps a RULER's alignment line continuous
// on non-collinear segments (see NodeRulerStatic / computeRulerGeometry3d).
//
// Dependency free (plain {x, y} objects) so it can be replayed in node.
export default function offsetPointsAlongNormals(pts, distance, closed) {
  const n = pts.length;
  if (n < 2) return pts.map((p) => ({ ...p }));
  return pts.map((p, i) => {
    let prev;
    let next;
    if (closed) {
      prev = pts[(i - 1 + n) % n];
      next = pts[(i + 1) % n];
    } else {
      prev = i > 0 ? pts[i - 1] : p;
      next = i < n - 1 ? pts[i + 1] : p;
    }
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (matches the 3D sweep side).
    return { ...p, x: p.x + ty * distance, y: p.y + -tx * distance };
  });
}
