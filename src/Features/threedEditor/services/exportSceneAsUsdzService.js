import { Mesh, MeshStandardMaterial, Scene } from "three";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

import { getActiveThreedEditor } from "./threedEditorRegistry";

// USDZExporter only emits meshes whose material is MeshStandardMaterial /
// MeshPhysicalMaterial. The viewer uses MeshBasicMaterial everywhere (the
// scene only has AmbientLight, so PBR would render dark). We rebuild a
// throw-away export scene with the same geometries and a MeshStandardMaterial
// that preserves color + map, so the resulting .usdz contains the basemap
// texture and the GLB textures embedded in the zip.
function toExportableMaterial(source) {
  return new MeshStandardMaterial({
    color: source?.color ? source.color.clone() : 0xffffff,
    map: source?.map ?? null,
    transparent: !!source?.transparent,
    opacity: source?.opacity ?? 1,
    side: source?.side,
    vertexColors: !!source?.vertexColors,
    metalness: 0,
    roughness: 1,
  });
}

// Object3D.traverse can't prune subtrees — walk manually so we can skip the
// entire gizmo helper subtree (tagged userData.isGizmo in TransformControlsManager).
function traverseExportable(obj, cb) {
  if (obj.userData?.isGizmo) return;
  cb(obj);
  for (const child of obj.children) traverseExportable(child, cb);
}

function buildExportScene(sourceScene) {
  sourceScene.updateMatrixWorld(true);

  const exportScene = new Scene();
  traverseExportable(sourceScene, (obj) => {
    if (!obj.isMesh) return;

    const cloned = new Mesh(obj.geometry, toExportableMaterial(obj.material));
    cloned.matrix.copy(obj.matrixWorld);
    cloned.matrix.decompose(cloned.position, cloned.quaternion, cloned.scale);
    cloned.matrixAutoUpdate = true;
    exportScene.add(cloned);
  });

  // USDZExporter reads object.matrixWorld, not object.matrix. Without this
  // call each cloned mesh's matrixWorld is still its constructor default
  // (identity), so the source's world rotation — including the basemap's
  // -π/2 X rotation that lays it flat on the XZ plane — is silently lost
  // and the basemap exports as a vertical wall.
  exportScene.updateMatrixWorld(true);
  return exportScene;
}

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: "model/vnd.usdz+zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default async function exportSceneAsUsdzService(filename = "scene.usdz") {
  const editor = getActiveThreedEditor();
  const scene = editor?.sceneManager?.scene;
  if (!scene) throw new Error("[exportSceneAsUsdzService] no active 3D scene");

  // Hide the GridHelper while we snapshot — the grid is a viewer aid, not
  // part of the model the user wants to ship to their iPhone.
  const grid = editor.sceneManager.grid;
  const prevGridVisible = grid ? grid.visible : null;
  if (grid) grid.visible = false;

  let exportScene;
  try {
    exportScene = buildExportScene(scene);
  } finally {
    if (grid) grid.visible = prevGridVisible;
  }

  const exporter = new USDZExporter();
  const buffer = await exporter.parseAsync(exportScene);
  triggerDownload(buffer, filename);
}
