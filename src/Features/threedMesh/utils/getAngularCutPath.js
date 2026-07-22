import { dot } from "./vec3Utils.js";
import { projectPointTo2d } from "./planeProjection.js";
import pointInPolygon2d from "./pointInPolygon2d.js";

// Geometry of the angular cut (CUT_ANGULAR): a V-shaped cut of a planar
// maille face made of two VERTICAL planes meeting on the vertical line through
// the angle vertex O.
//
// The scene is Y-up. O is picked in the horizontal plane of the first point A,
// so the direction O→A is purely horizontal (an azimuth); the same holds for
// O→B. The vertical line through O pierces the face plane at V — the vertex of
// the cut path drawn on the maille — and each branch is the intersection of
// its vertical plane with the face, taken from V toward its point and extended
// to the face boundary.
//
// Everything below the "world" inputs is expressed in the face plane basis
// (2D, meters), ready for splitFacePolygon path mode.

// A face whose normal is (nearly) horizontal is never met by the vertical line
// through O: the tool is undefined there.
const MIN_NORMAL_UP = 1e-3;
const EPS = 1e-9;

const cross2d = (a, b) => a.x * b.y - a.y * b.x;

// Horizontal (x, z) direction from p to q, normalized. Null when both points
// share the same horizontal position.
export function horizontalDir(p, q) {
  const x = q.x - p.x;
  const z = q.z - p.z;
  const len = Math.hypot(x, z);
  if (len < 1e-9) return null;
  return { x: x / len, z: z / len };
}

// Signed angle (deg) from dirA to dirB around world up (+Y), in (-180, 180].
export function signedAngleDeg(dirA, dirB) {
  const sin = dirA.z * dirB.x - dirA.x * dirB.z;
  const cos = dirA.x * dirB.x + dirA.z * dirB.z;
  return (Math.atan2(sin, cos) * 180) / Math.PI;
}

// Rotate a horizontal direction around +Y (same sign convention as
// signedAngleDeg: rotating dirA by θ yields a direction at signed angle θ).
export function rotateHorizontalDir(dir, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: dir.x * c + dir.z * s, z: -dir.x * s + dir.z * c };
}

// A vertical face has no angular cut: the vertical line through O never meets
// its plane.
export function supportsAngularCut(basis) {
  return Math.abs(basis?.n?.y ?? 0) >= MIN_NORMAL_UP;
}

// Where the vertical line through `o` pierces the face plane (world coords).
export function getFacePlaneVertex(o, basis) {
  const n = basis.n;
  if (Math.abs(n.y) < MIN_NORMAL_UP) return null;
  const d =
    n.x * (o.x - basis.origin.x) +
    n.y * (o.y - basis.origin.y) +
    n.z * (o.z - basis.origin.z);
  return { x: o.x, y: o.y - d / n.y, z: o.z };
}

// In-plane 2D direction whose horizontal projection is `dirH`: the vector of
// the face plane that "runs along" the given azimuth (steeper than dirH on a
// sloped face, equal to it on a horizontal one).
export function inPlaneDirFromHorizontal(dirH, basis) {
  const n = basis.n;
  if (Math.abs(n.y) < MIN_NORMAL_UP) return null;
  const w = {
    x: dirH.x,
    y: -(n.x * dirH.x + n.z * dirH.z) / n.y,
    z: dirH.z,
  };
  const d2 = { x: dot(w, basis.u), y: dot(w, basis.v) };
  const len = Math.hypot(d2.x, d2.y);
  if (len < 1e-12) return null;
  return { x: d2.x / len, y: d2.y / len };
}

// Parameters t where the line `p + t * dir` crosses the edges of a 2D loop.
function lineParamsOnLoop(loop, p, dir) {
  const ts = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p1 = loop[i];
    const p2 = loop[(i + 1) % n];
    const e = { x: p2.x - p1.x, y: p2.y - p1.y };
    const denom = cross2d(dir, e);
    if (Math.abs(denom) < EPS) continue;
    const w = { x: p1.x - p.x, y: p1.y - p.y };
    const s = cross2d(w, dir) / denom;
    if (s < -EPS || s > 1 + EPS) continue;
    ts.push(cross2d(w, e) / denom);
  }
  return ts;
}

// Segment of the infinite line `p + t * dir` clipped to the contour extents
// (same min/max convention as the vertical / horizontal cut tools: on a
// concave contour the line spans the gaps).
export function clipLineToContour(contour2d, p, dir) {
  const ts = lineParamsOnLoop(contour2d, p, dir);
  if (ts.length < 2) return null;
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  if (tMax - tMin < EPS) return null;
  return [
    { x: p.x + tMin * dir.x, y: p.y + tMin * dir.y },
    { x: p.x + tMax * dir.x, y: p.y + tMax * dir.y },
  ];
}

// First point where the ray `p + t * dir` (t > 0) leaves the face material:
// the nearest crossing of the contour or of a hole boundary.
export function getRayExit(contour2d, holes2d, p, dir) {
  let best = null;
  for (const loop of [contour2d, ...(holes2d || [])]) {
    if (!loop || loop.length < 3) continue;
    for (const t of lineParamsOnLoop(loop, p, dir)) {
      if (t <= EPS) continue;
      if (best === null || t < best) best = t;
    }
  }
  if (best === null) return null;
  return { x: p.x + best * dir.x, y: p.y + best * dir.y, length: best };
}

// Is the vertex of the V inside the face material?
function isVertexInside(v2d, contour2d, holes2d) {
  if (!pointInPolygon2d(v2d, contour2d)) return false;
  return !(holes2d || []).some((hole) => pointInPolygon2d(v2d, hole));
}

/**
 * Reference branch preview (between the 1st and the 2nd click): the full
 * intersection of the vertical plane through A and the temporary O with the
 * face, clipped to the contour.
 *
 * @returns {{ v2d, dir2d, line2d:[{x,y},{x,y}] } | null}
 */
export function getAngularCutLine({ basis, contour2d, a, o }) {
  const dirH = horizontalDir(o, a);
  if (!dirH) return null;
  const vertex = getFacePlaneVertex(o, basis);
  if (!vertex) return null;
  const dir2d = inPlaneDirFromHorizontal(dirH, basis);
  if (!dir2d) return null;
  const v2d = projectPointTo2d(vertex, basis);
  const line2d = clipLineToContour(contour2d, v2d, dir2d);
  if (!line2d) return null;
  return { v2d, dir2d, line2d };
}

/**
 * Full V cut path (after the 2nd click), optionally constrained to a typed
 * angle — the mouse then only picks the side the angle opens to.
 *
 * @param {object} args
 * @param {{origin,u,v,n}} args.basis - face plane basis
 * @param {Array<{x,y}>} args.contour2d
 * @param {Array<Array<{x,y}>>} [args.holes2d]
 * @param {{x,y,z}} args.a - reference extremity (world), gives the azimuth O→A
 * @param {{x,y,z}} args.o - angle vertex (world), in the horizontal plane of A
 * @param {{x,y,z}} args.b - second extremity (world), same horizontal plane
 * @param {number} [args.angleDeg] - typed constraint (deg, > 0)
 * @returns {{ v2d, path2d, angleDeg, endA2d, endB2d, dirA2d, dirB2d } | null}
 */
export default function getAngularCutPath({
  basis,
  contour2d,
  holes2d = [],
  a,
  o,
  b,
  angleDeg,
}) {
  const dirHA = horizontalDir(o, a);
  let dirHB = horizontalDir(o, b);
  if (!dirHA || !dirHB) return null;

  // Typed angle: keep the side the cursor is on, force the opening.
  if (Number.isFinite(angleDeg) && angleDeg > 0) {
    const side = signedAngleDeg(dirHA, dirHB) < 0 ? -1 : 1;
    dirHB = rotateHorizontalDir(dirHA, side * angleDeg);
  }

  const vertex = getFacePlaneVertex(o, basis);
  if (!vertex) return null;
  const v2d = projectPointTo2d(vertex, basis);
  if (!isVertexInside(v2d, contour2d, holes2d)) return null;

  const dirA2d = inPlaneDirFromHorizontal(dirHA, basis);
  const dirB2d = inPlaneDirFromHorizontal(dirHB, basis);
  if (!dirA2d || !dirB2d) return null;

  const endA2d = getRayExit(contour2d, holes2d, v2d, dirA2d);
  const endB2d = getRayExit(contour2d, holes2d, v2d, dirB2d);
  if (!endA2d || !endB2d) return null;

  return {
    v2d,
    dirA2d,
    dirB2d,
    endA2d,
    endB2d,
    path2d: [{ x: endA2d.x, y: endA2d.y }, v2d, { x: endB2d.x, y: endB2d.y }],
    angleDeg: Math.abs(signedAngleDeg(dirHA, dirHB)),
  };
}
