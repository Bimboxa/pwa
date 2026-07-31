// Shared geometric frame of a plan-view REVOLUTION_AXIS.
//
// The axis is stored as:
//   - point        : the CENTRE (a db.points ref, normalized against the plan
//                    base map reference frame; resolved to pixels upstream)
//   - radiusM      : radius of the drawn circle, in metres — GRAPHICAL ONLY
//                    (it sizes the circle and the diameter, nothing else)
//   - directionDeg : the diameter direction, in degrees, expressed in the plan
//                    base map's LOCAL METRE frame (y UP, CCW from local +X)
//   - invertHalf   : adds 180° to the direction
//
// `directionDeg` lives in the local METRE frame rather than image pixels on
// purpose: every consumer that matters — baseMapLocalToWorld, the vertical base
// map pose solver and the lathe phi mapping — works in that frame, so the
// y-down flip happens exactly once (here, for the SVG renderer) instead of
// leaking a sign into each of them.
//
// ORANGE-HALF CONVENTION
// The orange half-disc is the one BEHIND the placed vertical base map, i.e. on
// the -normal side of its plane. In the plan LOCAL frame that is always the
// +90°-CCW side of the effective diameter direction. This is an exact identity
// for ANY plan base map angle: writing u_p / v_p for the plan's local +X / +Y
// as world vectors and d = (dx, dy) for the local direction,
//     dir = dx·u_p + dy·v_p
//     n   = dir × ŷ = dy·u_p − dx·v_p
//     (−dy, dx) ↦ −dy·u_p + dx·v_p = −n
// On screen (y down) it reads as: diameter pointing right ⇒ orange half up.
const DEG = Math.PI / 180;

// A local-frame direction (y up) maps to a pixel-frame direction by flipping y:
//   x_local = (px − W/2)·m      y_local = −(py − H/2)·m
const localDirToPx = (d) => ({ x: d.x, y: -d.y });

/**
 * @param {Object} params
 * @param {{x:number,y:number}} params.centerPx  centre in reference-frame pixels
 * @param {number} params.radiusM
 * @param {number} params.directionDeg           local metre frame, y up, CCW
 * @param {boolean} [params.invertHalf]
 * @param {number} [params.meterByPx]            plan base map scale
 * @param {number} [params.fallbackRadiusPx]     used when the plan has no scale
 * @returns {Object|null}
 */
export default function getRevolutionAxisPlanFrame({
  centerPx,
  radiusM,
  directionDeg,
  invertHalf = false,
  meterByPx,
  fallbackRadiusPx = 60,
}) {
  if (!centerPx || !Number.isFinite(centerPx.x) || !Number.isFinite(centerPx.y))
    return null;

  const theta = (Number(directionDeg) || 0) * DEG + (invertHalf ? Math.PI : 0);

  // Unit direction of the diameter, and the orange side, both in the local
  // metre frame (y up) — then mirrored into pixel space for the renderer.
  const dirLocal = { x: Math.cos(theta), y: Math.sin(theta) };
  const orangeLocal = { x: -Math.sin(theta), y: Math.cos(theta) };

  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const r = Number(radiusM);
  // A scale-less plan base map still has to draw something usable.
  const radiusPx =
    hasScale && Number.isFinite(r) && r > 0 ? r / meterByPx : fallbackRadiusPx;

  const dirPx = localDirToPx(dirLocal);
  const orangePx = localDirToPx(orangeLocal);

  return {
    centerPx,
    radiusPx,
    // Effective direction (invertHalf already folded in), radians, local frame.
    theta,
    dirLocal,
    orangeLocal,
    dirPx,
    orangePx,
    // The two diameter ends, in pixels: [0] along +dir, [1] the antipode.
    rimPx: [
      {
        x: centerPx.x + radiusPx * dirPx.x,
        y: centerPx.y + radiusPx * dirPx.y,
      },
      {
        x: centerPx.x - radiusPx * dirPx.x,
        y: centerPx.y - radiusPx * dirPx.y,
      },
    ],
  };
}

// Inverse of the direction convention: given a pixel-space vector from the
// centre to a dragged handle, return the `directionDeg` to store.
export function getDirectionDegFromPxVector(vx, vy) {
  // px → local: flip y back.
  return (Math.atan2(-vy, vx) * 180) / Math.PI;
}

export { DEG as DEG_TO_RAD };
