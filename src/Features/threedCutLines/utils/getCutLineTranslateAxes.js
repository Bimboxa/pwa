import { cross, dot, normalize, sub } from "./vec3.js";

// |direction · face normal| under which a direction lies in the face.
const IN_PLANE_DOT = 0.1;
const PARALLEL_DOT = 0.999;

// Directions a cut line may be translated along when one of its segments is
// grabbed (useCutLineTranslateHandlers). A cut line never floats: the move
// must keep every DRAWN point on a face it sits on (the derived points are
// recomputed at the drop).
//
//   1. the perpendicular of the grabbed segment in the plane of a face that
//      carries it (`n × t`) — one per carrying face (two on a floor / wall
//      edge);
//   2. when none keeps the drawn points on their faces: the user axes that
//      do (the axis along the segment left out: it would slide the line on
//      itself);
//   3. last resort (a line drawn over several faces with no common
//      direction): the user axes not along the segment.
//
//   a, b         world ends of the grabbed segment
//   grabPlanes   [{ normal }] faces holding the grab point
//   drawnPlanes  per drawn point, [{ normal }] the faces holding it (an
//                empty list constrains nothing)
//   userAxes     [{ key, dir }] unit axes of the user frame
//
// Returns [{ key, dir: {x,y,z}, user }] (unit dirs), possibly empty.
export default function getCutLineTranslateAxes({
  a,
  b,
  grabPlanes = [],
  drawnPlanes = [],
  userAxes = [],
}) {
  const t = normalize(sub(b, a));
  if (!t) return [];

  const keepsDrawnPointsOnFaces = (dir) =>
    drawnPlanes.every(
      (planes) =>
        !planes?.length ||
        planes.some((p) => Math.abs(dot(p.normal, dir)) < IN_PLANE_DOT)
    );

  const perps = [];
  for (const plane of grabPlanes) {
    if (Math.abs(dot(plane.normal, t)) >= IN_PLANE_DOT) continue;
    const dir = normalize(cross(plane.normal, t));
    if (!dir) continue;
    if (perps.some((p) => Math.abs(dot(p.dir, dir)) > PARALLEL_DOT)) continue;
    perps.push({ key: `PERP_${perps.length}`, dir, user: false });
  }
  const validPerps = perps.filter((p) => keepsDrawnPointsOnFaces(p.dir));
  if (validPerps.length) return validPerps;

  const axes = userAxes
    .filter((axis) => Math.abs(dot(axis.dir, t)) < PARALLEL_DOT)
    .map((axis) => ({
      key: axis.key,
      dir: { x: axis.dir.x, y: axis.dir.y, z: axis.dir.z },
      user: true,
    }));
  const validAxes = axes.filter((axis) => keepsDrawnPointsOnFaces(axis.dir));
  return validAxes.length ? validAxes : axes;
}
