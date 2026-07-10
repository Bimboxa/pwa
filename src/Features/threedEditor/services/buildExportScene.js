import { Mesh, Scene } from "three";

import { getActiveThreedEditor } from "./threedEditorRegistry";

// Roots that hold the "real" exportable content: the basemap groups and the
// annotation objects. Same two maps ClippingManager._computeSceneBox walks to
// bound the model — anything NOT under these (grid, transform gizmos, the
// clipping-plane PlaneHelper quad, the section contour) is viewer-only.
function collectRoots(sceneManager, { excludeBaseMaps = false } = {}) {
  const annots = sceneManager.annotationsManager?.annotationsObjectsMap || {};
  const roots = [...Object.values(annots)];
  if (!excludeBaseMaps) {
    const images = sceneManager.imagesManager?.imagesMap || {};
    roots.unshift(...Object.values(images));
  }
  return roots.filter(Boolean);
}

// Build a throw-away Scene of cloned, visible meshes for a scene exporter.
//
// WHITELIST by design: we only descend the basemap + annotation roots, so
// viewer-only helpers never leak into the export. Walking the whole scene and
// blacklisting helpers (the old USDZ approach) let the clipping-plane helper —
// a translucent quad child of a PlaneHelper, tagged userData.isClipHelper but
// still an isMesh — export as a stray orange/pink plane.
//
// `makeMaterial` adapts each source material to the target exporter's needs
// (USDZ requires MeshStandardMaterial; OBJ keeps the source material as-is).
// `options.excludeBaseMaps` drops the basemap plane images from the export.
export default function buildExportScene(
  makeMaterial = (m) => m,
  options = {}
) {
  const editor = getActiveThreedEditor();
  const sceneManager = editor?.sceneManager;
  if (!sceneManager?.scene) {
    throw new Error("[buildExportScene] no active 3D scene");
  }

  sceneManager.scene.updateMatrixWorld(true);

  const exportScene = new Scene();
  const walk = (obj) => {
    if (obj.visible === false) return; // honor hidden basemaps / annotations
    // Realistic-mode helpers living INSIDE the whitelisted roots: the shadow
    // catcher overlays the basemap plane, the hover stipple overlays a face.
    if (obj.userData?.isShadowCatcher || obj.userData?.isHoverOverlay) return;
    if (obj.isMesh) {
      const cloned = new Mesh(obj.geometry, makeMaterial(obj.material));
      cloned.matrix.copy(obj.matrixWorld);
      cloned.matrix.decompose(cloned.position, cloned.quaternion, cloned.scale);
      cloned.matrixAutoUpdate = true;
      exportScene.add(cloned);
    }
    for (const child of obj.children) walk(child);
  };
  collectRoots(sceneManager, options).forEach(walk);

  // Exporters read object.matrixWorld, not object.matrix — refresh so the baked
  // world transforms (incl. the basemap's -π/2 X rotation that lays it flat on
  // the XZ plane) survive the export instead of collapsing to identity.
  exportScene.updateMatrixWorld(true);
  return exportScene;
}
