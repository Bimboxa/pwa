import computeFaceAxisCut from "../../threedFaceCut/utils/computeFaceAxisCut.js";
import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";
import {
  cross,
  dot,
  normalize,
  scale,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

// An axis this parallel to the face normal (|axis · n|) cannot run along the
// face: the tool is unusable on it.
const AXIS_OFF_FACE_DOT = 0.95;

// An existing cut line is a reference of the face when its segment lies in
// the face plane (m, the clipFaceByCutLines tolerance), is parallel to the
// axis (across drift per metre) and is long enough to have a direction.
const CUT_LINE_PLANE_TOL = 1e-2;
const CUT_LINE_PARALLEL_TOL = 1e-3;
const CUT_LINE_MIN_LENGTH = 1e-6;

// Trace of the X / Y / Z axis tools of the cut line (CutLineAxisOverlayThreed)
// on a planar face: the chord of the face PARALLEL to the chosen user axis,
// at the cursor's position across it — the meshing « Découpe » logic
// (computeFaceAxisCut) in the frame { u: the axis projected in the face,
// v: ± n × u } instead of the H / V frame, so a rotated frame rotates the
// trace. The reference is the face's extreme vertex along -v (S toggles
// `side`, which flips v: the opposite edge of the face), or the cut line
// already drawn on the face, parallel to the axis, nearest behind the
// cursor; the guide sits at `offset` from each of them (snap), a typed
// distance locks the line there.
//
//   - face: { contour, holes, normal } world (open loops);
//   - axisDir: unit world direction of the user axis;
//   - cursor: world point on the face; side: "LEFT" | "RIGHT";
//   - typedDistance: m or null; offset: m (the « Décalage » guide);
//   - snapToleranceM: snap distance across the trace (m);
//   - cutLines: [{ points: [{x, y, z}] }] world polylines of the existing
//     cut lines (cutLineObjectsStore.getCutLinesWorldPolylines).
//
// Returns { usable: false } when the axis is normal to the face, else
// { usable: true, chord: [a, b] | null, ref, guide, distance, snapped,
// locked, endsOnHole, basis } (world points). Pure (no three.js).
export default function computeCutLineAxisChord({
  face,
  axisDir,
  cursor,
  side = "LEFT",
  typedDistance = null,
  offset = 0,
  snapToleranceM = 0,
  cutLines = [],
}) {
  const contour = face?.contour;
  if (!contour || contour.length < 3 || !face.normal || !axisDir || !cursor)
    return { usable: false };
  const n = normalize(face.normal);
  if (Math.abs(dot(axisDir, n)) > AXIS_OFF_FACE_DOT) return { usable: false };
  const u = normalize(sub(axisDir, scale(n, dot(axisDir, n))));
  // The across direction runs AWAY from the reference edge: the other side
  // (S) flips it, so the reference becomes the opposite edge of the face.
  const v0 = cross(n, u);
  const v = side === "RIGHT" ? scale(v0, -1) : v0;
  const basis = { origin: contour[0], u, v, n };

  const to2d = (p) => projectPointTo2d(p, basis);
  const loops2d = [
    contour.map(to2d),
    ...(face.holes || []).filter((h) => h?.length >= 3).map((h) => h.map(to2d)),
  ];

  // Cut lines already lying on the face, parallel to the axis: references
  // the distance is measured from.
  const [contour2d, ...holes2d] = loops2d;
  const refCoords = [];
  for (const line of cutLines || []) {
    const points = line?.points || [];
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (
        Math.abs(dot(sub(a, basis.origin), n)) > CUT_LINE_PLANE_TOL ||
        Math.abs(dot(sub(b, basis.origin), n)) > CUT_LINE_PLANE_TOL
      )
        continue;
      const a2 = to2d(a);
      const b2 = to2d(b);
      const length = Math.hypot(b2.x - a2.x, b2.y - a2.y);
      if (length < CUT_LINE_MIN_LENGTH) continue;
      if (Math.abs(b2.y - a2.y) > CUT_LINE_PARALLEL_TOL * Math.max(1, length))
        continue;
      const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
      if (!pointInPolygon2d(mid, contour2d)) continue;
      if (holes2d.some((hole) => pointInPolygon2d(mid, hole))) continue;
      refCoords.push(mid.y);
    }
  }

  const result = computeFaceAxisCut({
    loops2d,
    cursor2d: to2d(cursor),
    axis: "H",
    typedDistance,
    snapToleranceM,
    guideDistances: offset > 0 ? [offset] : [],
    refCoords,
  });
  if (!result) return { usable: false };

  const lift = (p2) => liftPointTo3d(p2, basis);
  return {
    usable: true,
    chord: result.chord2d ? result.chord2d.map(lift) : null,
    ref: lift(result.ref2d),
    guide: lift(result.guide2d),
    distance: result.distance,
    snapped: result.snapped,
    locked: result.locked,
    endsOnHole: result.endsOnHole,
    basis,
  };
}
