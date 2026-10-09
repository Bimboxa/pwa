// Module-level holder of the most-recent base map plane hit computed by the
// 3D axis draft overlay (RevolutionAxisDraftOverlayThreed): the pointer
// handler commits exactly the point the user sees under the hover marker.
// Mirrors threedDimensions/services/lastDimensionSnapStore.js.
//
// Also carries the live radius (metres) of the pending second click, polled
// by the drawing helper (SectionRevolutionAxisRadiusConstraintThreed) at animation-frame
// rate — a ref, not Redux, like segmentLengthPxRef in 2D.

let _lastHit = null; // { position: Vector3, baseMapId, group } | null

export const revolutionAxisDraftThreedRef = { radiusM: 0 };

export function getLastRevolutionAxisHit() {
  return _lastHit;
}

export function setLastRevolutionAxisHit(v) {
  _lastHit = v;
}
