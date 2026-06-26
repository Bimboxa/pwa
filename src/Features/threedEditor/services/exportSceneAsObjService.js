import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

import buildExportScene from "./buildExportScene";
import downloadBlob from "Features/files/utils/downloadBlob";

// Wavefront OBJ export of the 3D scene, for re-editing in SketchUp (the geometry
// is triangulated — enable "Merge coplanar faces" on import to recover planar
// faces ready for Push/Pull). OBJExporter needs no material conversion: it only
// emits geometry (+ usemtl names), so we keep the source materials as-is.
export default function exportSceneAsObjService(filename = "scene.obj", options = {}) {
  const exportScene = buildExportScene(undefined, options);
  const text = new OBJExporter().parse(exportScene);
  const blob = new Blob([text], { type: "text/plain" });
  downloadBlob(blob, filename);
}
