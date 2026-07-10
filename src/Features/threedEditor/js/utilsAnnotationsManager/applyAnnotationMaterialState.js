// Material state machine for annotation 3D objects in the 3D viewer.
//
// Three states are supported:
//   - "hover" — fluo green singleton override.
//   - "dim"   — grey + low-opacity singleton override (applied to non-selected
//               annotations when the user has at least one annotation selected).
//   - "none"  — restore the cached original material.
//
// All meshes under `object3D` are walked. The very first time we touch a mesh,
// we cache its original material in `mesh.userData.originalMaterial` — this is
// the single source of truth used to restore the original. Hover and dim are
// orthogonal singleton overrides; transitioning between them does not require
// any special bookkeeping.

import { MeshBasicMaterial, DoubleSide } from "three";

const HOVER_MATERIAL = new MeshBasicMaterial({
  color: 0x00ff00,
  side: DoubleSide,
});

const DIM_MATERIAL = new MeshBasicMaterial({
  color: 0x888888,
  transparent: true,
  opacity: 0.3,
  side: DoubleSide,
  depthWrite: false,
});

const HOVER_COLOR = 0x00ff00;
const DIM_COLOR = 0x888888;

export const STATE_NONE = "none";
export const STATE_HOVER = "hover";
export const STATE_DIM = "dim";

// Active clipping planes for the highlight overrides. The hover/dim materials
// are swapped in place of the original (already-clipped) material, so without
// this they'd render the full geometry past the cut. There is a single global
// plane, so we keep the shared array module-side and sync the singletons +
// line clones to it. See setHighlightClippingPlanes.
let _clippingPlanes = null;

// Assign the active clipping planes to `mat`, flipping needsUpdate ONLY when the
// plane count transitions 0↔1 (that changes the shader; mutating the plane in
// place does not — matches ClippingManager's recompile-avoidance rationale).
function syncMaterialClipping(mat) {
  if (!mat) return;
  const next =
    _clippingPlanes && _clippingPlanes.length ? _clippingPlanes : null;
  if (mat.clippingPlanes === next) return;
  const had = !!(mat.clippingPlanes && mat.clippingPlanes.length);
  const has = !!next;
  mat.clippingPlanes = next;
  if (had !== has) mat.needsUpdate = true;
}

// Called when the clipping plane is enabled/disabled. Pass the shared planes
// array (clippingManager.planes) when active, null otherwise.
export function setHighlightClippingPlanes(planes) {
  _clippingPlanes = planes || null;
  syncMaterialClipping(HOVER_MATERIAL);
  syncMaterialClipping(DIM_MATERIAL);
}

// Fat-line objects (Line2, e.g. the POINT height trait) render with a
// LineMaterial; swapping in the MeshBasicMaterial singletons would break them
// (the instanced LineGeometry needs the line shader). Instead, lazily clone the
// original LineMaterial — preserving its linewidth/thickness, resolution,
// worldUnits and depthTest — and just recolor it. Clones are cached on the
// child so hover/dim transitions don't reallocate.
function isLineObject(child) {
  return (
    child.isLine2 ||
    child.isLineSegments2 ||
    !!child.userData?.originalMaterial?.isLineMaterial
  );
}

function lineStateMaterial(child, state) {
  const orig = child.userData.originalMaterial;
  if (state === STATE_HOVER) {
    if (!child.userData.hoverLineMaterial) {
      const m = orig.clone();
      m.color.set(HOVER_COLOR);
      child.userData.hoverLineMaterial = m;
    }
    // Cached clone — re-sync each call so clipping toggles take effect.
    syncMaterialClipping(child.userData.hoverLineMaterial);
    return child.userData.hoverLineMaterial;
  }
  if (state === STATE_DIM) {
    if (!child.userData.dimLineMaterial) {
      const m = orig.clone();
      m.color.set(DIM_COLOR);
      m.transparent = true;
      m.opacity = 0.3;
      child.userData.dimLineMaterial = m;
    }
    syncMaterialClipping(child.userData.dimLineMaterial);
    return child.userData.dimLineMaterial;
  }
  return orig;
}

export default function applyAnnotationMaterialState(object3D, state) {
  if (!object3D) return;

  object3D.traverse((child) => {
    if (!child.isMesh) return;
    // Transient face-hover overlays (faceHoverHighlight.js) live inside the
    // annotation tree — skip them so dim/lasso passes never cache the stipple
    // material as originalMaterial.
    if (child.userData?.isHoverOverlay) return;
    if (!child.userData) child.userData = {};
    if (!child.userData.originalMaterial) {
      child.userData.originalMaterial = child.material;
    }

    if (isLineObject(child)) {
      child.material = lineStateMaterial(child, state);
      return;
    }

    if (state === STATE_HOVER) {
      child.material = HOVER_MATERIAL;
    } else if (state === STATE_DIM) {
      child.material = DIM_MATERIAL;
    } else {
      child.material = child.userData.originalMaterial;
    }
  });
}
