import roundForDisplay from "./roundForDisplay.js";

// A chain whose vertices all lie on the host base map plane (within this
// tolerance, metres) is stored exactly like a 2D-drawn one: plain {id} point
// refs, no offsetZ. Matches IN_PLANE_EPS_M of commitDrawnCoteService.
const IN_PLANE_EPS_M = 5e-3;

// Pure Z encoding of a dimension chain (RULER) projected on its host base
// map — the cote rule generalized to N points:
//   - in-plane chain → offsetZ null, every offsetBottom 0;
//   - lifted / vertical / oblique chain → offsetZ = min offset, per-point
//     offsetBottom = offset - offsetZ, so z_i = offsetZ + offsetBottom_i
//     (base-map-local metres, the reconstruction rule of
//     computeRulerGeometry3d / triangulateAnnotationGeometry).
//
// `projected`: [{ x, y, offset }] from worldToBaseMapNormalized.
export default function encodeDimensionChainOffsets(
  projected,
  { epsM = IN_PLANE_EPS_M } = {}
) {
  const offsets = projected.map((p) => p.offset ?? 0);
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  const isInPlane = Math.abs(min) < epsM && max - min < epsM;

  const points = projected.map((p, i) => ({
    x: p.x,
    y: p.y,
    offsetBottom: isInPlane ? 0 : roundForDisplay(offsets[i] - min),
    offsetTop: 0,
  }));

  return {
    isInPlane,
    offsetZ: isInPlane ? null : roundForDisplay(min),
    points,
  };
}
