// Plan symbol of a door in a wall gap: the leaf (a line perpendicular to the
// wall, as long as the opening) hinged on one jamb, and the quarter-circle
// swing arc from the leaf tip back to the opposite jamb.
//
// Conventions (image px, y down):
//   - p1 / p2 : the opening endpoints on the wall centerline (jambs)
//   - doorHinge : "START" → hinge on p1, "END" → hinge on p2
//   - doorSide  : +1 → the leaf swings to the LEFT of p1→p2 (normal (-uy, ux),
//                 same convention as offsetPolylineAsPolygon), -1 → right
//   - bandWidth : wall thickness — the leaf starts on the wall FACE (half the
//                 band away from the centerline) on the swing side
//
// Returns null on a degenerate segment.
export default function getDoorSwingGeometry({
  p1,
  p2,
  bandWidth = 0,
  doorHinge = "START",
  doorSide = 1,
}) {
  if (!p1 || !p2) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;

  const ux = dx / length;
  const uy = dy / length;
  const side = doorSide === -1 ? -1 : 1;
  // Left normal of p1→p2, flipped by the swing side.
  const nx = -uy * side;
  const ny = ux * side;

  const hingeAtEnd = doorHinge === "END";
  const hinge = hingeAtEnd ? p2 : p1;
  const jamb = hingeAtEnd ? p1 : p2;

  const faceOffset = Math.max(0, bandWidth) / 2;
  const leafStart = {
    x: hinge.x + nx * faceOffset,
    y: hinge.y + ny * faceOffset,
  };
  const leafEnd = {
    x: leafStart.x + nx * length,
    y: leafStart.y + ny * length,
  };
  const arcEnd = {
    x: jamb.x + nx * faceOffset,
    y: jamb.y + ny * faceOffset,
  };

  // SVG arc sweep flag: 1 = increasing angle, i.e. clockwise on a y-down
  // screen. The arc runs from the leaf tip (direction n from the hinge) to the
  // opposite jamb (direction ±u): that rotation n → u increases the angle when
  // cross(n, u) > 0 (y-down frame).
  const towardJambX = hingeAtEnd ? -ux : ux;
  const towardJambY = hingeAtEnd ? -uy : uy;
  const cross = nx * towardJambY - ny * towardJambX;
  const sweepFlag = cross > 0 ? 1 : 0;

  return {
    hinge,
    jamb,
    leafStart,
    leafEnd,
    arcEnd,
    radius: length,
    sweepFlag,
    normal: { x: nx, y: ny },
  };
}
