// getAxisSnap.js
//
// Distant-point axis snapping for annotation drawing.
//
// While drawing, the crosshair (ScreenCursorV2) has a vertical and a horizontal
// branch. When a branch passes close to an existing point, the new point should
// snap in the direction NORMAL to that branch:
//   - vertical branch close to a point   -> snap the new point's X to that point
//   - horizontal branch close to a point -> snap the new point's Y to that point
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
//   - snapPx:       active snap threshold (red fill), default 6px
//   - approachPx:   approach band (grey ring), default 16px
//
// Returns null when no candidate is within the approach band, otherwise:
//   {
//     x | null,        // snapped LOCAL x (vertical branch lock), null if none
//     y | null,        // snapped LOCAL y (horizontal branch lock), null if none
//     xScreen | null,  // viewport x of the X-aligned point (to lock the crosshair)
//     yScreen | null,  // viewport y of the Y-aligned point
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
  snapPx = 6,
  approachPx = 16,
}) {
  if (!candidates?.length || !cursorScreen || typeof project !== "function") {
    return null;
  }

  let bestX = null; // { dAxis, mouseDist, localX, screenX, screenY, active }
  let bestY = null; // { dAxis, mouseDist, localY, screenX, screenY, active }

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

    const dx = Math.abs(s.x - cursorScreen.x);
    const dy = Math.abs(s.y - cursorScreen.y);
    const mouseDist = Math.hypot(s.x - cursorScreen.x, s.y - cursorScreen.y);

    if (dx <= approachPx) {
      const cand = {
        dAxis: dx,
        mouseDist,
        localX: p.x,
        screenX: s.x,
        screenY: s.y,
        active: dx <= snapPx,
      };
      if (isBetterAxisCandidate(cand, bestX)) bestX = cand;
    }
    if (dy <= approachPx) {
      const cand = {
        dAxis: dy,
        mouseDist,
        localY: p.y,
        screenX: s.x,
        screenY: s.y,
        active: dy <= snapPx,
      };
      if (isBetterAxisCandidate(cand, bestY)) bestY = cand;
    }
  }

  if (!bestX && !bestY) return null;

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
    x: bestX && bestX.active ? bestX.localX : null,
    y: bestY && bestY.active ? bestY.localY : null,
    xScreen: bestX && bestX.active ? bestX.screenX : null,
    yScreen: bestY && bestY.active ? bestY.screenY : null,
    markers,
  };
}
