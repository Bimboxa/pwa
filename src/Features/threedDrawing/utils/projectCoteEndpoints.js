import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";

import roundForDisplay from "./roundForDisplay";

// A cote whose endpoints both lie on the host baseMap plane (within this
// tolerance, metres) is stored exactly like a 2D-drawn cote: plain {id}
// point refs, no offsetZ. Matches OFFSET_EPS_M of classifyFaceVsBaseMap.
const IN_PLANE_EPS_M = 5e-3;

// Projection of the two world endpoints of a cote on its host base map, with
// the Z encoding of the annotation (see commitDrawnCoteService):
//   - in-plane segment → offsetBottom 0 on both points, no offsetZ;
//   - lifted / vertical / oblique segment → offsetZ = min offset, per-point
//     offsetBottom = offset - offsetZ.
//
// Returns { isInPlane, offsetZ, projectedPoints: [{ x, y, offsetBottom,
// offsetTop }] } — x / y normalized on the host — or null when an endpoint
// does not project on the host.
export default function projectCoteEndpoints({ a, b, host }) {
  const pA = worldToBaseMapNormalized(a, host);
  const pB = worldToBaseMapNormalized(b, host);
  if (!pA || !pB) return null;

  const isInPlane =
    Math.abs(pA.offset) < IN_PLANE_EPS_M &&
    Math.abs(pB.offset - pA.offset) < IN_PLANE_EPS_M;

  const baseOffset = Math.min(pA.offset, pB.offset);
  const projectedPoints = [pA, pB].map((p) => ({
    x: p.x,
    y: p.y,
    offsetBottom: isInPlane ? 0 : roundForDisplay(p.offset - baseOffset),
    offsetTop: 0,
  }));

  return {
    isInPlane,
    offsetZ: isInPlane ? null : roundForDisplay(baseOffset),
    projectedPoints,
  };
}
