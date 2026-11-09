import { circleFromThreePoints, typeOf } from "./arcSampling";

// Chord / sagitta geometry of a square → circle → square (S-C-S) arc.
//
// The circle-typed control point P1 lies ON the arc (anywhere on it, not
// necessarily at its apex). The chord is P0 → P2; the sagitta (« flèche ») is
// the distance between the chord midpoint and the arc apex — the arc point
// farthest from the chord, which sits on the chord's perpendicular bisector.
//
// Only arcSampling (dependency free) is imported, so everything here can be
// replayed in node.

const TWO_PI = Math.PI * 2;

// Same validity bound as the renderer (NodePolylineStatic.buildPathAndMap):
// beyond it the triplet is drawn as straight lines.
export const MAX_ARC_RADIUS_PX = 100000;

const rot90 = (v) => ({ x: -v.y, y: v.x });

// Counter-clockwise (in atan2 terms) angle from `a` to `b`, in [0, 2π).
function ccwDelta(a, b) {
  let d = b - a;
  while (d < 0) d += TWO_PI;
  while (d >= TWO_PI) d -= TWO_PI;
  return d;
}

// Signed sweep from the angle of P0 to the angle of P2 around `center`, going
// through the side pointed by `normal` (the arc apex direction seen from the
// center). Positive = ccw in atan2 terms.
function signedSweep(center, p0, p2, normal) {
  const a0 = Math.atan2(p0.y - center.y, p0.x - center.x);
  const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  const aMid = Math.atan2(normal.y, normal.x);
  const dMid = ccwDelta(a0, aMid);
  const d2 = ccwDelta(a0, a2);
  return dMid <= d2 ? d2 : -(TWO_PI - d2);
}

// Full frame of an S-C-S arc (types are NOT checked here — see
// isExactArcTriplet). Returns null when the chord or the circle degenerates.
//
// { center, r, chordMid, chordPx, chordDir, normal, handedness, sagittaPx,
//   arcMid, t }
//   normal     unit vector ⟂ chord, pointing to P1's side (the whole arc lies
//              on that side)
//   handedness ±1 such that normal = handedness · rot90(chordDir)
//   t          angular fraction of P1 along the arc from P0 (0..1)
export function getArcFrame(p0, p1, p2) {
  if (!p0 || !p1 || !p2) return null;
  const cx = p2.x - p0.x;
  const cy = p2.y - p0.y;
  const chordPx = Math.hypot(cx, cy);
  if (!(chordPx > 1e-9)) return null;
  const chordDir = { x: cx / chordPx, y: cy / chordPx };
  const perp = rot90(chordDir);
  const side = (p1.x - p0.x) * perp.x + (p1.y - p0.y) * perp.y;
  if (Math.abs(side) < 1e-9) return null; // collinear
  const handedness = side > 0 ? 1 : -1;
  const normal = { x: perp.x * handedness, y: perp.y * handedness };

  const circ = circleFromThreePoints(p0, p1, p2);
  if (!circ || !Number.isFinite(circ.r) || circ.r <= 0) return null;
  const { center, r } = circ;

  const chordMid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  // Signed distance center ↔ chord, positive on P1's side (major arc).
  const dSigned =
    (center.x - chordMid.x) * normal.x + (center.y - chordMid.y) * normal.y;
  const sagittaPx = r + dSigned;
  const arcMid = {
    x: chordMid.x + normal.x * sagittaPx,
    y: chordMid.y + normal.y * sagittaPx,
  };

  const sweep = signedSweep(center, p0, p2, normal);
  const a0 = Math.atan2(p0.y - center.y, p0.x - center.x);
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const d1 = sweep >= 0 ? ccwDelta(a0, a1) : TWO_PI - ccwDelta(a0, a1);
  const t = Math.abs(sweep) > 1e-12 ? Math.min(1, d1 / Math.abs(sweep)) : 0.5;

  return {
    center,
    r,
    chordMid,
    chordPx,
    chordDir,
    normal,
    handedness,
    sagittaPx,
    arcMid,
    t,
  };
}

// S-C-S typed triplet whose circle is valid and drawable as a true arc.
export function isExactArcTriplet(p0, p1, p2) {
  if (
    typeOf(p0) === "circle" ||
    typeOf(p1) !== "circle" ||
    typeOf(p2) === "circle"
  )
    return false;
  const frame = getArcFrame(p0, p1, p2);
  return Boolean(frame) && frame.r <= MAX_ARC_RADIUS_PX;
}

// Control point of the arc with chord P0 → P2, apex on the `normal` side at
// `sagittaPx` from the chord midpoint, placed at angular fraction `t`.
// Returns null when the chord or the sagitta degenerates.
export function controlFromChordAndSagitta({ p0, p2, normal, sagittaPx, t }) {
  const c = Math.hypot(p2.x - p0.x, p2.y - p0.y);
  const h = sagittaPx;
  if (!(c > 1e-9) || !(h > 1e-9)) return null;
  const r = (c * c) / 4 / (2 * h) + h / 2; // (c²/4 + h²) / 2h
  const chordMid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  const center = {
    x: chordMid.x + normal.x * (h - r),
    y: chordMid.y + normal.y * (h - r),
  };
  const sweep = signedSweep(center, p0, p2, normal);
  const a0 = Math.atan2(p0.y - center.y, p0.x - center.x);
  const a = a0 + sweep * t;
  return { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) };
}

// New control point after the arc endpoints moved to newP0 / newP2: the
// sagitta and the control's angular fraction are preserved, so the arc keeps
// its height whatever the new chord (a pure translation yields a translated
// control). Falls back to the mean endpoint translation when the geometry
// degenerates.
export function relocateArcControl({ p0, p1, p2, newP0, newP2 }) {
  const fallback = {
    x: p1.x + (newP0.x - p0.x + newP2.x - p2.x) / 2,
    y: p1.y + (newP0.y - p0.y + newP2.y - p2.y) / 2,
  };
  const frame = getArcFrame(p0, p1, p2);
  if (!frame) return fallback;
  const cx = newP2.x - newP0.x;
  const cy = newP2.y - newP0.y;
  const c = Math.hypot(cx, cy);
  if (!(c > 1e-9)) return fallback;
  const perp = rot90({ x: cx / c, y: cy / c });
  const normal = {
    x: perp.x * frame.handedness,
    y: perp.y * frame.handedness,
  };
  return (
    controlFromChordAndSagitta({
      p0: newP0,
      p2: newP2,
      normal,
      sagittaPx: frame.sagittaPx,
      t: frame.t,
    }) ?? fallback
  );
}

// Typed sagitta edit: only the control point moves, the chord stays.
// Returns { ok: true, point } | { ok: false, reason: "INVALID_INPUT" }.
export function computeArcSagittaEdit({ p0, p1, p2, targetPx }) {
  if (!Number.isFinite(targetPx) || targetPx <= 0)
    return { ok: false, reason: "INVALID_INPUT" };
  const frame = getArcFrame(p0, p1, p2);
  if (!frame) return { ok: false, reason: "INVALID_INPUT" };
  const c = frame.chordPx;
  const r = (c * c) / 4 / (2 * targetPx) + targetPx / 2;
  // Too flat: the triplet would be collinear for the renderer.
  if (!Number.isFinite(r) || r > MAX_ARC_RADIUS_PX)
    return { ok: false, reason: "INVALID_INPUT" };
  const point = controlFromChordAndSagitta({
    p0,
    p2,
    normal: frame.normal,
    sagittaPx: targetPx,
    t: frame.t,
  });
  if (!point) return { ok: false, reason: "INVALID_INPUT" };
  return { ok: true, point };
}
