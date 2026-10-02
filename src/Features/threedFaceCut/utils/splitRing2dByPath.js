// Splits a 2D polygon outline in two along a path drawn across it — the
// plan-side twin of splitMesh3dFace's boundary-to-boundary cut, used to keep
// a polygon annotation cut on its plan face a pair of regular annotations.
//
// ring: [{x, y}] the outline (open, 3+ points); path: [{x, y}] the cut (open,
// 2+ points), in one metric frame. The path must start and end on the outline
// (on a corner or an edge, within `tolerance`), run strictly inside it in
// between, and stay clear of the holes ([[{x, y}]]).
//
// Returns { ringA, ringB, holesA, holesB } or null when the path does not cut
// the outline in two. Each ring is a list of entries:
//   { kind: "VERTEX", index }          a corner of the outline
//   { kind: "EDGE", index, t, x, y }   a cut end inserted on edge index→index+1
//   { kind: "INTERIOR", x, y }         an inner point of the path
// The two cut ends are the SAME entry objects in both rings (one new point
// each). holesA / holesB: indices of the holes falling in each piece.
export default function splitRing2dByPath(
  ring,
  path,
  { tolerance = 1e-3, holes = [] } = {}
) {
  if (!ring || ring.length < 3 || !path || path.length < 2) return null;

  const start = locateOnRing(ring, path[0], tolerance);
  const end = locateOnRing(ring, path[path.length - 1], tolerance);
  if (!start || !end) return null;
  if (Math.hypot(start.x - end.x, start.y - end.y) <= tolerance) return null;

  const inner = path.slice(1, -1);
  const isInside = (p) =>
    pointInRing(p, ring) &&
    distanceToRing(p, ring) > tolerance &&
    !holes.some((hole) => pointInRing(p, hole));
  if (!inner.every(isInside)) return null;

  // Every segment runs inside: its middle is inside, and it crosses neither
  // the outline (but at the cut ends) nor a hole.
  const cutPath = [start, ...inner, end];
  for (let k = 0; k < cutPath.length - 1; k++) {
    const a = cutPath[k];
    const b = cutPath[k + 1];
    if (!isInside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) return null;
    for (const loop of [ring, ...holes]) {
      for (let i = 0; i < loop.length; i++) {
        const hit = intersectSegments(
          a,
          b,
          loop[i],
          loop[(i + 1) % loop.length]
        );
        if (!hit) continue;
        const atEnd =
          loop === ring &&
          (Math.hypot(hit.x - start.x, hit.y - start.y) <= tolerance ||
            Math.hypot(hit.x - end.x, hit.y - end.y) <= tolerance);
        if (!atEnd) return null;
      }
    }
  }

  // Outline with the cut ends inserted, in walking order.
  const entries = ring.map((p, index) => ({
    kind: "VERTEX",
    index,
    key: index,
  }));
  const startEntry = toEntry(start, entries);
  const endEntry = toEntry(end, entries);
  entries.sort((a, b) => a.key - b.key);
  const ip = entries.indexOf(startEntry);
  const iq = entries.indexOf(endEntry);
  if (ip < 0 || iq < 0 || ip === iq) return null;

  const interior = inner.map((p) => ({ kind: "INTERIOR", x: p.x, y: p.y }));
  const ringA = [...getArc(entries, ip, iq), ...[...interior].reverse()];
  const ringB = [...getArc(entries, iq, ip), ...interior];
  entries.forEach((entry) => delete entry.key);

  const toPoint = (entry) =>
    entry.kind === "VERTEX" ? ring[entry.index] : entry;
  const areaA = Math.abs(signedArea(ringA.map(toPoint)));
  const areaB = Math.abs(signedArea(ringB.map(toPoint)));
  const minArea = tolerance * tolerance;
  if (areaA <= minArea || areaB <= minArea) return null;

  const outlineA = ringA.map(toPoint);
  const holesA = [];
  const holesB = [];
  holes.forEach((hole, index) =>
    (pointInRing(hole[0], outlineA) ? holesA : holesB).push(index)
  );
  return { ringA, ringB, holesA, holesB };
}

// A cut end on the outline: its corner, or a new entry on its edge (sorted
// after the edge's first corner by `t`).
function toEntry(location, entries) {
  if (location.kind === "VERTEX") return entries[location.index];
  const entry = {
    kind: "EDGE",
    index: location.index,
    t: location.t,
    x: location.x,
    y: location.y,
    key: location.index + location.t,
  };
  entries.push(entry);
  return entry;
}

// Corner (preferred) or edge of the outline the point lies on, or null.
function locateOnRing(ring, p, tolerance) {
  for (let index = 0; index < ring.length; index++) {
    const q = ring[index];
    if (Math.hypot(p.x - q.x, p.y - q.y) <= tolerance) {
      return { kind: "VERTEX", index, x: q.x, y: q.y };
    }
  }
  let best = null;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const { t, distance, x, y } = projectOnSegment(p, a, b);
    if (t <= 0 || t >= 1 || distance > tolerance) continue;
    if (!best || distance < best.distance) {
      best = { kind: "EDGE", index, t, x, y, distance };
    }
  }
  return best;
}

function projectOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { t, x, y, distance: Math.hypot(p.x - x, p.y - y) };
}

function distanceToRing(p, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const { t, distance } = projectOnSegment(
      p,
      ring[i],
      ring[(i + 1) % ring.length]
    );
    const d =
      t <= 0
        ? Math.hypot(p.x - ring[i].x, p.y - ring[i].y)
        : t >= 1
          ? Math.hypot(
              p.x - ring[(i + 1) % ring.length].x,
              p.y - ring[(i + 1) % ring.length].y
            )
          : distance;
    if (d < best) best = d;
  }
  return best;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Intersection point of segments ab and cd (touching included), or null.
function intersectSegments(a, b, c, d) {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-15) return null; // parallel: the midpoint test rules
  const u = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const v = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  const eps = 1e-9;
  if (u < -eps || u > 1 + eps || v < -eps || v > 1 + eps) return null;
  return { x: a.x + u * rx, y: a.y + u * ry };
}

function getArc(entries, from, to) {
  const arc = [];
  let i = from;
  for (;;) {
    arc.push(entries[i]);
    if (i === to) break;
    i = (i + 1) % entries.length;
  }
  return arc;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

// A closed path drawn strictly inside the outline (clear of the holes): the
// piece it encloses becomes a new polygon and a hole of the outline. Returns
// { enclosedHoles } — the indices of the holes inside the loop, which move to
// the new polygon — or null when the loop is not strictly inside.
export function locateInnerLoopInRing(
  ring,
  loop,
  { tolerance = 1e-3, holes = [] } = {}
) {
  if (!ring || ring.length < 3 || !loop || loop.length < 3) return null;
  if (Math.abs(signedArea(loop)) <= tolerance * tolerance) return null;
  const isInside = (p) =>
    pointInRing(p, ring) &&
    distanceToRing(p, ring) > tolerance &&
    !holes.some((hole) => pointInRing(p, hole));

  for (let k = 0; k < loop.length; k++) {
    const a = loop[k];
    const b = loop[(k + 1) % loop.length];
    if (!isInside(a)) return null;
    if (!isInside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) return null;
    for (const other of [ring, ...holes]) {
      for (let i = 0; i < other.length; i++) {
        if (intersectSegments(a, b, other[i], other[(i + 1) % other.length]))
          return null;
      }
    }
  }
  const enclosedHoles = [];
  holes.forEach((hole, index) => {
    if (pointInRing(hole[0], loop)) enclosedHoles.push(index);
  });
  return { enclosedHoles };
}
