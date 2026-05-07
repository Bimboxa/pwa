// Module-level holder for the most-recent snap candidate computed by the
// drawing overlay. Read by the click handler so it commits exactly the
// position the user sees under the hover marker, without prop-drilling.

let _last = null;

export function getLastSnap() {
  return _last;
}

export function setLastSnap(v) {
  _last = v;
}
