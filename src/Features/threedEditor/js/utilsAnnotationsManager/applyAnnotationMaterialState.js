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

export const STATE_NONE = "none";
export const STATE_HOVER = "hover";
export const STATE_DIM = "dim";

export default function applyAnnotationMaterialState(object3D, state) {
  if (!object3D) return;

  object3D.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.userData) child.userData = {};
    if (!child.userData.originalMaterial) {
      child.userData.originalMaterial = child.material;
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
