// Module-level holder for the most-recent snap candidate computed by the
// dimension draft overlay. Read by the dimension pointer handler so a click
// commits exactly the position the user sees under the hover marker, without
// prop-drilling. Mirrors threedDrawing/services/lastSnapStore.js.

let _last = null;

export function getLastDimensionSnap() {
  return _last;
}

export function setLastDimensionSnap(v) {
  _last = v;
}
