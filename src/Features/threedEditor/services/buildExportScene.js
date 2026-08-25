import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  Mesh,
  Scene,
} from "three";

import { getActiveThreedEditor } from "./threedEditorRegistry";

// Roots that hold the "real" exportable content: the basemap groups and the
// annotation objects. Same two maps ClippingManager._computeSceneBox walks to
// bound the model — anything NOT under these (grid, transform gizmos, the
// clipping-plane PlaneHelper quad, the section contour) is viewer-only.
function collectRoots(sceneManager, { excludeBaseMaps = false } = {}) {
  const annots = sceneManager.annotationsManager?.annotationsObjectsMap || {};
  const roots = [...Object.values(annots)];
  // Textured photoPlan planes count as basemap-like content.
  if (!excludeBaseMaps) {
    const images = sceneManager.imagesManager?.imagesMap || {};
    roots.unshift(...Object.values(images));
    const photoPlans = sceneManager.photoPlansManager?.objectsMap || {};
    roots.push(...Object.values(photoPlans));
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
    // Render-mode helpers living INSIDE the whitelisted roots: the shadow
    // catcher overlays the basemap plane, the hover stipple overlays a face,
    // the aquarelle ink edges are children of every mesh (LineSegments2 is an
    // isMesh — it would export as broken geometry).
    if (
      obj.userData?.isShadowCatcher ||
      obj.userData?.isHoverOverlay ||
      obj.userData?.isSketchEdge ||
      // Partial-revolution section markers (fat boundary lines + poché fill)
      // are display-only decorations, same story as the sketch edges.
      obj.userData?.isSectionMarker
    ) {
      return;
    }
    // Fat lines (Line2 / LineSegments2: the POINT vertical trait, the POINT
    // revolution circle) are `isMesh` over INSTANCED geometry — cloned as-is
    // they export as broken triangles. Emit a plain THREE.Line rebuilt from
    // the source positions instead: OBJExporter writes it as `l` elements,
    // which SketchUp reads as a polyline.
    //
    // Opt-in by design (a tag, not a blanket `obj.isLine` branch): every
    // extrusion / lathe carries a black EdgesGeometry LineSegments overlay,
    // and a generic branch would dump all of them into the OBJ.
    const exportLine = obj.userData?.exportLine;
    if (exportLine?.positions?.length >= 6) {
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(exportLine.positions, 3)
      );
      const cloned = new Line(geometry, makeMaterial(obj.material));
      cloned.matrix.copy(obj.matrixWorld);
      cloned.matrix.decompose(cloned.position, cloned.quaternion, cloned.scale);
      cloned.matrixAutoUpdate = true;
      exportScene.add(cloned);
    } else if (obj.isMesh) {
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
