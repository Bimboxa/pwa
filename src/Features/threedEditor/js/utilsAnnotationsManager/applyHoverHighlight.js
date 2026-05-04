// Swaps every mesh material under `object3D` for a fluo-green override on
// hover, and restores the original on unhover. We swap the whole material
// (instead of just tinting `material.color`) because GLB materials may carry
// a texture map or vertex colors that dominate the rendered color, making a
// pure color tint nearly invisible.
//
// The first time we touch a mesh we cache its original material in
// `mesh.userData.originalMaterial` so repeated hover/unhover cycles restore
// faithfully.

import { MeshBasicMaterial } from "three";

const HOVER_MATERIAL = new MeshBasicMaterial({ color: 0x00ff00 }); // vert fluo

export default function applyHoverHighlight(object3D, hovered) {
  if (!object3D) return;

  object3D.traverse((child) => {
    if (!child.isMesh) return;
    if (!child.userData) child.userData = {};

    if (hovered) {
      if (!child.userData.originalMaterial) {
        child.userData.originalMaterial = child.material;
      }
      child.material = Array.isArray(child.userData.originalMaterial)
        ? child.userData.originalMaterial.map(() => HOVER_MATERIAL)
        : HOVER_MATERIAL;
    } else if (child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });
}
