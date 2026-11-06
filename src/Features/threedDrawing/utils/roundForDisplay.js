// Round a numeric value for storage / display: `offsetZ`, `height` and the
// per-point `offsetTop` / `offsetBottom` of annotations created from the 3D
// drawing flow, so the user doesn't see e.g. `1.110339449` in the edit
// toolbar.
//
// Fixed 0.1 mm step: it only removes float noise (2.4999999 → 2.5) and never
// moves the geometry by a visible amount — a point snapped on an existing
// vertex must land back on it. (A coarser rule — 3 significant figures, snap
// to the integer within 5 mm — used to shift small details by up to several
// millimetres.)
const STEP_PER_M = 1e4;

export default function roundForDisplay(value) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * STEP_PER_M) / STEP_PER_M;
  return rounded === 0 ? 0 : rounded; // no -0
}
