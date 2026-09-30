// Two drawn points closer than this (m) are the same point.
const SAME_POINT_EPS_M = 1e-4;

const isSamePoint = (p, q, eps) =>
  Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < eps;

// Extends a freshly drawn path with the persistent traits it connects to
// (mesh drawing: a segment that cut nothing yet stays on screen as a trait,
// and the next ones are chained to it — a notch drawn in three separate
// segments reaches the face boundary only with the last one).
//
// The path grows from both ends while exactly ONE unused trait starts at the
// tip: a fork is ambiguous and stops the walk. The chain is closed when its
// two ends meet.
//
// vertices: [{x, y, z, ...}] in drawing order. traits: [{a, b}].
// Returns { vertices, closed, usedTraits } — a closed chain comes without
// its closing duplicate.
export default function chainDrawnPath(
  vertices,
  traits = [],
  eps = SAME_POINT_EPS_M
) {
  const path = [...(vertices || [])];
  const used = new Set();
  if (path.length < 2) return { vertices: path, closed: false, usedTraits: [] };

  const isClosed = () =>
    path.length >= 4 && isSamePoint(path[0], path[path.length - 1], eps);

  const extend = (atEnd) => {
    for (;;) {
      if (isClosed()) return;
      const tip = atEnd ? path[path.length - 1] : path[0];
      const matches = [];
      traits.forEach((trait, index) => {
        if (used.has(index)) return;
        if (isSamePoint(trait.a, tip, eps) || isSamePoint(trait.b, tip, eps)) {
          matches.push(index);
        }
      });
      if (matches.length !== 1) return;
      const trait = traits[matches[0]];
      used.add(matches[0]);
      const next = isSamePoint(trait.a, tip, eps) ? trait.b : trait.a;
      if (atEnd) path.push(next);
      else path.unshift(next);
    }
  };
  extend(true);
  extend(false);

  const closed = isClosed();
  if (closed) path.pop();
  return {
    vertices: path,
    closed,
    usedTraits: [...used].map((index) => traits[index]),
  };
}
