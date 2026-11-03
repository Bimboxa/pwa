import computeFaceAxisCut from "../../threedFaceCut/utils/computeFaceAxisCut.js";
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

// Trace of the X / Y / Z axis tools of the cut line (CutLineAxisOverlayThreed)
// on a planar face: the chord of the face PARALLEL to the chosen user axis,
// at the cursor's position across it — the meshing « Découpe » logic
// (computeFaceAxisCut) in the frame { u: the axis projected in the face,
// v: n × u } instead of the H / V frame, so a rotated frame rotates the
// trace. The reference is the face's extreme vertex along -v (the `side`
// corner, S toggles it), the guide sits at `offset` from it (snap), a typed
// distance locks the line there.
//
//   - face: { contour, holes, normal } world (open loops);
//   - axisDir: unit world direction of the user axis;
//   - cursor: world point on the face; side: "LEFT" | "RIGHT";
//   - typedDistance: m or null; offset: m (the « Décalage » guide);
//   - snapToleranceM: snap distance across the trace (m).
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
}) {
  const contour = face?.contour;
  if (!contour || contour.length < 3 || !face.normal || !axisDir || !cursor)
    return { usable: false };
  const n = normalize(face.normal);
  if (Math.abs(dot(axisDir, n)) > AXIS_OFF_FACE_DOT) return { usable: false };
  const u = normalize(sub(axisDir, scale(n, dot(axisDir, n))));
  const v = cross(n, u);
  const basis = { origin: contour[0], u, v, n };

  const to2d = (p) => projectPointTo2d(p, basis);
  const loops2d = [
    contour.map(to2d),
    ...(face.holes || []).filter((h) => h?.length >= 3).map((h) => h.map(to2d)),
  ];
  const result = computeFaceAxisCut({
    loops2d,
    cursor2d: to2d(cursor),
    axis: "H",
    side,
    typedDistance,
    snapToleranceM,
    guideDistances: offset > 0 ? [offset] : [],
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
