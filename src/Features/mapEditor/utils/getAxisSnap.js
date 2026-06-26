// getAxisSnap.js
//
// Distant-point axis snapping for annotation drawing.
//
// While drawing, the crosshair (ScreenCursorV2) has a vertical and a horizontal
// branch. When a branch passes close to an existing point, the new point should
// snap in the direction NORMAL to that branch:
//   - vertical branch close to a point   -> lock the point onto that branch
//   - horizontal branch close to a point -> lock the point onto that branch
//
// The crosshair branches are rotated by the ortho-snap angle (ScreenCursorV2
// applies `rotate(-angle)`), so all proximity / locking is computed in the
// ROTATED branch frame, not the fixed screen X/Y axes. With angle = 0 this
// reduces to plain horizontal/vertical alignment.
//
// Proximity is measured in SCREEN pixels so the snap radius is zoom-independent.
//
// Selection rules:
//   - Off-screen candidates are ignored.
//   - At most ONE point is selected per axis: the one closest to the axis, and
//     among (near-)equally-aligned points, the one closest to the mouse.
//
// Params:
//   - candidates:   array of { x, y } points in LOCAL (image-pixel) space
//   - cursorScreen: { x, y } cursor position in viewport-pixel space
//   - project:      (localPt) => { x, y } viewport-pixel position of a local point
//   - bounds:       { width, height } viewport size — candidates projected
//                   outside it are discarded (not visible on screen)
//   - angleDeg:     ortho-snap angle of the crosshair branches (degrees)
//   - snapPx:       active snap threshold (red fill), default 6px
//   - approachPx:   approach band (grey ring), default 16px
//
// Returns null when no candidate is within the approach band, otherwise:
//   {
//     screen: { x, y },   // corrected cursor viewport pos (branches locked)
//     hasLock: boolean,   // true when at least one axis is actively snapped
//     markers: [{ screenX, screenY, active }]  // grey rings / red fills to draw
//   }

const AXIS_TIE_EPS = 0.5; // px — distances-to-axis within this are "equal"

// Better candidate for an axis: primarily closest to the axis, tie-broken by
// closest to the mouse.
function isBetterAxisCandidate(cand, best) {
  if (!best) return true;
  if (Math.abs(cand.dAxis - best.dAxis) > AXIS_TIE_EPS) {
    return cand.dAxis < best.dAxis;
  }
  return cand.mouseDist < best.mouseDist;
}

export default function getAxisSnap({
  candidates,
  cursorScreen,
  project,
  bounds,
  angleDeg = 0,
  snapPx = 6,
  approachPx = 16,
}) {
  if (!candidates?.length || !cursorScreen || typeof project !== "function") {
    return null;
  }

  // Rotated branch frame (matches ScreenCursorV2's `rotate(-angle)`):
  //   u = direction of the horizontal branch (normal to the vertical branch)
  //   v = direction of the vertical branch   (normal to the horizontal branch)
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const u = { x: cos, y: -sin };
  const v = { x: sin, y: cos };

  let bestX = null; // vertical-branch candidate { dAxis, mouseDist, comp, screenX, screenY, active }
  let bestY = null; // horizontal-branch candidate

  for (const p of candidates) {
    const s = project(p);
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;

    // Visibility filter — ignore points outside the viewport.
    if (
      bounds &&
      (s.x < 0 || s.x > bounds.width || s.y < 0 || s.y > bounds.height)
    ) {
      continue;
    }

    const wx = s.x - cursorScreen.x;
    const wy = s.y - cursorScreen.y;
    const mouseDist = Math.hypot(wx, wy);

    // Component along u = signed distance to the vertical branch.
    // Component along v = signed distance to the horizontal branch.
    const compU = wx * u.x + wy * u.y;
    const compV = wx * v.x + wy * v.y;
    const dxAxis = Math.abs(compU); // proximity to the vertical branch
    const dyAxis = Math.abs(compV); // proximity to the horizontal branch

    if (dxAxis <= approachPx) {
      const cand = {
        dAxis: dxAxis,
        mouseDist,
        comp: compU,
        screenX: s.x,
        screenY: s.y,
        active: dxAxis <= snapPx,
      };
      if (isBetterAxisCandidate(cand, bestX)) bestX = cand;
    }
    if (dyAxis <= approachPx) {
      const cand = {
        dAxis: dyAxis,
        mouseDist,
        comp: compV,
        screenX: s.x,
        screenY: s.y,
        active: dyAxis <= snapPx,
      };
      if (isBetterAxisCandidate(cand, bestY)) bestY = cand;
    }
  }

  if (!bestX && !bestY) return null;

  // Corrected cursor: shift along u to lock onto the vertical branch candidate,
  // along v to lock onto the horizontal branch candidate.
  let screenX = cursorScreen.x;
  let screenY = cursorScreen.y;
  let hasLock = false;
  if (bestX && bestX.active) {
    screenX += u.x * bestX.comp;
    screenY += u.y * bestX.comp;
    hasLock = true;
  }
  if (bestY && bestY.active) {
    screenX += v.x * bestY.comp;
    screenY += v.y * bestY.comp;
    hasLock = true;
  }

  // One marker per axis (deduped when both axes resolve to the same point).
  const markers = [];
  const samePoint =
    bestX &&
    bestY &&
    bestX.screenX === bestY.screenX &&
    bestX.screenY === bestY.screenY;
  if (samePoint) {
    markers.push({
      screenX: bestX.screenX,
      screenY: bestX.screenY,
      active: bestX.active || bestY.active,
    });
  } else {
    if (bestX) {
      markers.push({ screenX: bestX.screenX, screenY: bestX.screenY, active: bestX.active });
    }
    if (bestY) {
      markers.push({ screenX: bestY.screenX, screenY: bestY.screenY, active: bestY.active });
    }
  }

  return {
    screen: { x: screenX, y: screenY },
    hasLock,
    markers,
  };
}
