import {
  circleFromThreePoints,
  sampleArcPoints,
  typeOf,
} from "../../geometry/utils/arcSampling.js";

// 3D sibling of expandArcsInPath (Features/geometry/utils/arcSampling): a
// square → circle → square run of {x, y, z, type?} vertices is the circular
// arc through the three points, sampled in THEIR plane. Anchor vertices are
// kept with all their properties (baseMapId, faceNormal…); sampled points
// are plain {x, y, z}. Collinear triplets fall back to straight segments.
//
// Used by the 3D drawing overlay (curved in-progress line / rubber band) and
// by commitDrawnPolylineService to bake an arc off its host base map plane.
//
// `samples` per half-arc: a number, or a function (sweepRadians) => count
// (adaptiveArcSamples) like expandRingWithOffsets.

// Relative sine threshold under which the three points are collinear.
const COLLINEAR_EPS = 1e-6;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a) => Math.sqrt(dot(a, a));
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });

// Orthonormal frame {origin, u, v, normal} of the plane through three
// points (u along p0 → p1), or null when they are (nearly) collinear.
export function planeFrameFromThreePoints(p0, p1, p2) {
  const a = sub(p1, p0);
  const b = sub(p2, p0);
  const la = length(a);
  const lb = length(b);
  if (la < 1e-12 || lb < 1e-12) return null;
  const n = cross(a, b);
  const ln = length(n);
  if (ln < COLLINEAR_EPS * la * lb) return null;
  const u = scale(a, 1 / la);
  const normal = scale(n, 1 / ln);
  const v = cross(normal, u);
  return { origin: p0, u, v, normal };
}

const to2d = (p, f) => {
  const d = sub(p, f.origin);
  return { x: dot(d, f.u), y: dot(d, f.v) };
};
const to3d = (q, f) => ({
  x: f.origin.x + f.u.x * q.x + f.v.x * q.y,
  y: f.origin.y + f.u.y * q.x + f.v.y * q.y,
  z: f.origin.z + f.u.z * q.x + f.v.z * q.y,
});

// Directional sweep (radians, absolute) from `from` to `to` around `center`,
// same normalization as sampleArcPoints.
function sweepAngle(center, from, to, isCW) {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  const TWO_PI = Math.PI * 2;
  let diff = a1 - a0;
  if (isCW) {
    while (diff < 0) diff += TWO_PI;
    while (diff >= TWO_PI) diff -= TWO_PI;
  } else {
    while (diff > 0) diff -= TWO_PI;
    while (diff <= -TWO_PI) diff += TWO_PI;
  }
  return Math.abs(diff);
}

export default function expandArcsInPath3d(
  path,
  samples = 16,
  closeLine = false
) {
  const n = path?.length ?? 0;
  if (n < 3) return (path || []).map((p) => ({ ...p }));

  const get = closeLine ? (k) => path[((k % n) + n) % n] : (k) => path[k];
  const resolveSamples = (center, from, to, isCW) =>
    typeof samples === "function"
      ? samples(sweepAngle(center, from, to, isCW))
      : samples;

  const out = [];
  let i = 0;
  let consumed = 0;
  while (consumed < n) {
    const p0 = get(i);
    const p1 = get(i + 1);
    const p2 = get(i + 2);
    const isArc =
      p1 &&
      p2 &&
      typeOf(p0) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";

    if (isArc) {
      const frame = planeFrameFromThreePoints(p0, p1, p2);
      const q0 = frame && to2d(p0, frame);
      const q1 = frame && to2d(p1, frame);
      const q2 = frame && to2d(p2, frame);
      const circ = frame && circleFromThreePoints(q0, q1, q2);
      if (circ && Number.isFinite(circ.r) && circ.r > 0) {
        const crossZ =
          (q1.x - q0.x) * (q2.y - q0.y) - (q1.y - q0.y) * (q2.x - q0.x);
        const isCW = crossZ > 0;
        const s01 = resolveSamples(circ.center, q0, q1, isCW);
        const s12 = resolveSamples(circ.center, q1, q2, isCW);
        // p0 with its properties, then the samples up to (excluding) p2 —
        // picked up as the p0 of the next iteration.
        out.push({ ...p0 });
        const arc01 = sampleArcPoints(q0, q1, circ.center, circ.r, isCW, s01);
        for (const s of arc01) out.push(to3d(s, frame));
        const arc12 = sampleArcPoints(q1, q2, circ.center, circ.r, isCW, s12);
        for (let k = 0; k < arc12.length - 1; k++) {
          out.push(to3d(arc12[k], frame));
        }
        i += 2;
        consumed += 2;
        continue;
      }
      // Degenerate (collinear): straight segments.
      out.push({ ...p0 });
      i += 1;
      consumed += 1;
      continue;
    }

    out.push({ ...p0 });
    i += 1;
    consumed += 1;
  }
  return out;
}
