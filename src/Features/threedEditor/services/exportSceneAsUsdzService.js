import { MeshStandardMaterial } from "three";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

import buildExportScene from "./buildExportScene";

// USDZExporter only emits meshes whose material is MeshStandardMaterial /
// MeshPhysicalMaterial. The viewer uses MeshBasicMaterial everywhere (the
// scene only has AmbientLight, so PBR would render dark). buildExportScene
// rebuilds a throw-away scene with the same geometries, and we map each source
// material to a MeshStandardMaterial that preserves color + map, so the
// resulting .usdz contains the basemap texture and the GLB textures.
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

export default async function exportSceneAsUsdzService(
  filename = "scene.usdz",
  options = {}
) {
  const exportScene = buildExportScene(toExportableMaterial, options);
  const exporter = new USDZExporter();
  const buffer = await exporter.parseAsync(exportScene);
  triggerDownload(buffer, filename);
}
