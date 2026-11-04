// Pure 3D sweep helpers for the inline "Extrusion" of a POLYLINE whose guide
// carries per-vertex offsets (offsetBottom — a chain that climbs, drawn in
// 3D with the vertex-offset mode M). The 2D helpers of sweepGeometry.js only
// read the plan trace of the guide: vertical runs (same plan point repeated
// with another offset) have no plan length and were dropped, and the
// cross-section was read as an elevation drawing. Here the guide is a true
// 3D polyline and the profile a planar 3D polyline, swept « Suivez-moi »
// style:
//   - registration: the visible guide segment nearest (in 3D) to the profile
//     vertices; the profile plane is rotated (smallest rotation) so that its
//     normal aligns with the segment tangent, around the profile vertex
//     nearest to that segment, so the sweep passes exactly through a profile
//     drawn perpendicular to the segment, and keeps its shape otherwise;
//   - frames: the registering segment's (n, b) frame is parallel-transported
//     along the chain (rotation taking one tangent to the next), both ways;
//   - joints: mitered rings in the bisector plane (projection of the incoming
//     ring along the incoming tangent), shared by both segments.
// No three / app imports — node-testable (sweepGeometry3d.test.mjs).

const EPS = 1e-9;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a) => Math.sqrt(dot(a, a));
const normalize = (a) => {
  const l = length(a);
  return l > EPS ? scale(a, 1 / l) : null;
};

// Rodrigues rotation of `v` taking unit `from` onto unit `to` (smallest
// rotation). Antiparallel inputs rotate by π around `fallbackAxis`.
function rotateBetween(v, from, to, fallbackAxis) {
  const c = dot(from, to);
  const axis = cross(from, to);
  const s = length(axis);
  if (s < EPS) {
    if (c > 0) return v;
    // π turn around the fallback axis: v' = 2 (v·a) a − v
    const a = fallbackAxis;
    return sub(scale(a, 2 * dot(v, a)), v);
  }
  const k = scale(axis, 1 / s);
  // v cosθ + (k × v) sinθ + k (k·v)(1 − cosθ)
  return add(
    add(scale(v, c), scale(cross(k, v), s)),
    scale(k, dot(k, v) * (1 - c))
  );
}

// True when the ring carries a vertical run: any vertex offsetBottom ≠ 0.
export function hasVerticalGuideOffsets(points) {
  return (points || []).some(
    (p) => Math.abs(Number(p?.offsetBottom) || 0) > 1e-6
  );
}

// Visible, non-degenerate segments of the chain → [{ index, a, b, t }].
function listSegments(points, hidden, closeLine) {
  const n = points.length;
  const segCount = closeLine ? n : n - 1;
  const out = [];
  for (let i = 0; i < segCount; i += 1) {
    if (hidden.has(i)) continue;
    const a = points[i];
    const b = points[(i + 1) % n];
    const t = normalize(sub(b, a));
    if (!t) continue;
    out.push({ index: i, a, b, t });
  }
  return out;
}

// Unclamped projection of P on the segment line, and the squared distance
// of P to the clamped segment.
function projectOnSegment(P, seg) {
  const ap = sub(P, seg.a);
  const len = length(sub(seg.b, seg.a));
  const s = dot(ap, seg.t);
  const sc = Math.max(0, Math.min(len, s));
  const closest = add(seg.a, scale(seg.t, sc));
  const d = sub(P, closest);
  return { s, d2: dot(d, d) };
}

// Newell normal of a 3D polyline (null when collinear / too short).
function polylineNormal(pts) {
  if (pts.length < 3) return null;
  const o = pts[0];
  let n = { x: 0, y: 0, z: 0 };
  for (let i = 1; i < pts.length - 1; i += 1) {
    n = add(n, cross(sub(pts[i], o), sub(pts[i + 1], o)));
  }
  return normalize(n);
}

// Segment-local frame (n, b) perpendicular to unit tangent t: n = world Z
// projected (b horizontal), or world X when t is vertical.
function frameFromTangent(t) {
  const Z = { x: 0, y: 0, z: 1 };
  let n = normalize(sub(Z, scale(t, dot(Z, t))));
  if (!n) {
    const X = { x: 1, y: 0, z: 0 };
    n = normalize(sub(X, scale(t, dot(X, t))));
  }
  return { t, n, b: cross(t, n) };
}

// Registration of a planar 3D profile against a 3D guide chain.
//
// Inputs: guidePoints / profilePoints as [{x, y, z}] in one consistent unit,
// hidden = Set of hidden guide segment indices, closeLine.
// Returns null when degenerate, else
// { segIndex, frame: {t, n, b}, section: [{u, w}] } — the cross-section in
// the registering segment's frame (ring vertex = P + u·n + w·b).
export function getSweep3dSetup({
  guidePoints,
  profilePoints,
  hidden = new Set(),
  closeLine = false,
}) {
  const guide = (guidePoints || []).filter(
    (p) =>
      Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z)
  );
  const profile = (profilePoints || []).filter(
    (p) =>
      Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z)
  );
  if (guide.length < 2 || profile.length < 2) return null;

  const segments = listSegments(guide, hidden, closeLine);
  if (segments.length === 0) return null;

  // Registering segment = nearest to the profile; C = the profile vertex
  // nearest to it (first one on ties).
  let best = null;
  for (const seg of segments) {
    for (let k = 0; k < profile.length; k += 1) {
      const { d2 } = projectOnSegment(profile[k], seg);
      if (!best || d2 < best.d2 - EPS) best = { seg, k, d2 };
    }
  }
  const { seg, k } = best;
  const C = profile[k];
  const t = seg.t;

  // Profile plane normal, oriented along the tangent. A collinear profile
  // (two points, straight cut) takes the plane containing it and the
  // tangent, so the rotation is a pure swing around the cut line.
  let normal = polylineNormal(profile);
  if (!normal) {
    const d =
      normalize(sub(profile[profile.length - 1], profile[0])) ??
      normalize(sub(profile[1], profile[0]));
    if (!d) return null;
    normal = normalize(sub(t, scale(d, dot(t, d))));
    if (!normal) return null; // profile along the tangent: nothing to sweep
  }
  if (dot(normal, t) < 0) normal = scale(normal, -1);
  const fallbackAxis = normalize(cross(normal, { x: 0, y: 0, z: 1 })) ?? {
    x: 1,
    y: 0,
    z: 0,
  };

  // Offsets from the segment line: the drawn profile rotated into the plane
  // ⟂ t around C, plus C's own transverse offset from the line (unclamped
  // projection), so the ring at C's foot is the drawn profile.
  const { s } = projectOnSegment(C, seg);
  const foot = add(seg.a, scale(t, s));
  const cOffset = sub(C, foot);
  const frame = frameFromTangent(t);
  const section = profile.map((p) => {
    const rotated = rotateBetween(sub(p, C), normal, t, fallbackAxis);
    const off = add(cOffset, rotated);
    return { u: dot(off, frame.n), w: dot(off, frame.b) };
  });

  return { segIndex: seg.index, frame, section };
}

// Per-segment frames [{t, n, b} | null] by parallel transport from the seed
// segment's frame, forward then backward (wrapping on a closed chain).
// Hidden / degenerate segments get null and are transported across.
export function computeSegmentFrames3d(
  points,
  hidden,
  closeLine,
  seedIndex,
  seedFrame
) {
  const n = points.length;
  const segCount = closeLine ? n : n - 1;
  const frames = new Array(segCount).fill(null);
  const tangents = new Array(segCount).fill(null);
  for (const seg of listSegments(points, hidden, closeLine)) {
    tangents[seg.index] = seg.t;
  }
  if (!tangents[seedIndex]) return frames;
  frames[seedIndex] = {
    t: tangents[seedIndex],
    n: seedFrame.n,
    b: seedFrame.b,
  };

  const transport = (fromFrame, t) => {
    const n =
      normalize(rotateBetween(fromFrame.n, fromFrame.t, t, fromFrame.n)) ??
      fromFrame.n;
    return { t, n, b: cross(t, n) };
  };

  // Forward.
  let prev = frames[seedIndex];
  const steps = closeLine ? segCount - 1 : segCount - 1 - seedIndex;
  for (let k = 1; k <= steps; k += 1) {
    const i = (seedIndex + k) % segCount;
    if (!tangents[i]) continue;
    frames[i] = transport(prev, tangents[i]);
    prev = frames[i];
  }
  // Backward (open chains only; a closed chain was covered by the wrap).
  if (!closeLine) {
    prev = frames[seedIndex];
    for (let i = seedIndex - 1; i >= 0; i -= 1) {
      if (!tangents[i]) continue;
      frames[i] = transport(prev, tangents[i]);
      prev = frames[i];
    }
  }
  return frames;
}

// Quad-strip arrays of the 3D sweep: each visible segment connects the rings
// at its endpoints; interior joints get one mitered ring shared by both
// segments (continuous surface). Fold-backs (tangents nearly opposite) fall
// back to two unshared rings.
// Returns { positions: number[], indices: number[] } or null.
export function buildSweepArrays3d(
  points,
  segFrames,
  hidden,
  section,
  closeLine = false
) {
  const n = points.length;
  const segCount = closeLine ? n : n - 1;
  const positions = [];
  const indices = [];
  let v = 0;

  const offsetIn = (frame, c) => add(scale(frame.n, c.u), scale(frame.b, c.w));
  const pushRing = (P, offsets) => {
    const base = v;
    for (const off of offsets) {
      const q = add(P, off);
      positions.push(q.x, q.y, q.z);
    }
    v += offsets.length;
    return base;
  };
  // Mitered offsets at the joint between frames fIn → fOut; null when the
  // joint folds back.
  const miterOffsets = (fIn, fOut) => {
    const M = normalize(add(fIn.t, fOut.t));
    if (!M) return null;
    const tm = dot(fIn.t, M);
    if (Math.abs(tm) < 0.05) return null;
    return section.map((c) => {
      const d = offsetIn(fIn, c);
      return sub(d, scale(fIn.t, dot(d, M) / tm));
    });
  };

  let prevEndBase = -1;
  let prevEndVertex = -1;

  for (let i = 0; i < segCount; i += 1) {
    const frame = segFrames[i];
    if (hidden.has(i) || !frame) {
      prevEndBase = -1;
      prevEndVertex = -1;
      continue;
    }
    const a = points[i];
    const endVertex = (i + 1) % n;
    const b = points[endVertex];

    let startBase;
    if (prevEndBase >= 0 && prevEndVertex === i) {
      startBase = prevEndBase;
    } else {
      startBase = pushRing(
        a,
        section.map((c) => offsetIn(frame, c))
      );
    }

    // End ring: mitered with the next visible segment when it starts here.
    const nextIndex = i + 1 < segCount ? i + 1 : closeLine ? 0 : -1;
    const nextFrame =
      nextIndex >= 0 && !hidden.has(nextIndex) ? segFrames[nextIndex] : null;
    const mitered = nextFrame ? miterOffsets(frame, nextFrame) : null;
    const endBase = pushRing(
      b,
      mitered ?? section.map((c) => offsetIn(frame, c))
    );

    for (let j = 0; j < section.length - 1; j += 1) {
      const a0 = startBase + j;
      const a1 = startBase + j + 1;
      const b0 = endBase + j;
      const b1 = endBase + j + 1;
      indices.push(a0, b0, b1, a0, b1, a1);
    }

    prevEndBase = mitered ? endBase : -1;
    prevEndVertex = endVertex;
  }

  // Closed chain: the last segment ends at vertex 0 where the first segment
  // started with its own ring — both rings are mitered identically only when
  // the transported frame returns to itself (planar chains); the seam is
  // otherwise left open rather than twisted.
  if (positions.length === 0) return null;
  return { positions, indices };
}

// Total 3D length of the visible segments.
export function getGuideLength3d(
  points,
  hidden = new Set(),
  closeLine = false
) {
  return listSegments(points, hidden, closeLine).reduce(
    (acc, seg) => acc + length(sub(seg.b, seg.a)),
    0
  );
}

// One-sided area of the sweep triangles.
export function getSweepArea3d(arrays) {
  if (!arrays) return 0;
  const { positions, indices } = arrays;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ab = {
      x: positions[b] - positions[a],
      y: positions[b + 1] - positions[a + 1],
      z: positions[b + 2] - positions[a + 2],
    };
    const ac = {
      x: positions[c] - positions[a],
      y: positions[c + 1] - positions[a + 1],
      z: positions[c + 2] - positions[a + 2],
    };
    area += length(cross(ab, ac)) / 2;
  }
  return area;
}
