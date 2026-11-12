import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

import collectAnnotationSectionMeshes from "Features/threedEditor/js/utilsClipping/collectAnnotationSectionMeshes";

import getCutLinesPromptMeshName from "../utils/getCutLinesPromptMeshName";
import { getAnnotationLabel } from "./collectCutLinesPromptRegions";

// scene.glb of « Ligne de coupe – prompt IA » (GLB mode): the solids of the
// visible annotations, ONE mesh per annotation named
// getCutLinesPromptMeshName(label, id), vertices baked in the scene frame
// (meters, Y up) — the frame of contexte.json and of the answer.
//
// Whitelist: only the annotation solids kept by
// collectAnnotationSectionMeshes (no base map image, gizmo, helper, maille,
// cut line or overlay).
//
// Returns { blob, meshCount, triangleCount }, or null when nothing is shown.
export default async function buildCutLinesPromptGlb({ editor }) {
  const annotationsManager = editor?.sceneManager?.annotationsManager;
  const map = annotationsManager?.annotationsObjectsMap || {};
  const material = new MeshStandardMaterial({ color: 0xb0b0b0 });
  const scene = new Scene();
  const v = new Vector3();
  let triangleCount = 0;

  for (const [annotationId, root] of Object.entries(map)) {
    if (!root?.visible) continue;
    const meshes = collectAnnotationSectionMeshes(
      { annotationsObjectsMap: { [annotationId]: root } },
      { visibleOnly: true }
    );
    const positions = [];
    for (const mesh of meshes) {
      const position = mesh.geometry?.attributes?.position;
      if (!position) continue;
      mesh.updateWorldMatrix(true, false);
      const matrix = mesh.matrixWorld;
      // A mirrored transform flips the winding: keep the normals outward.
      const mirrored = matrix.determinant() < 0;
      const index = mesh.geometry.index;
      const count = index ? index.count : position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const order = mirrored ? [i, i + 2, i + 1] : [i, i + 1, i + 2];
        for (const k of order) {
          v.fromBufferAttribute(position, index ? index.getX(k) : k);
          v.applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
        }
      }
    }
    if (!positions.length) continue;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const out = new Mesh(geometry, material);
    out.name = getCutLinesPromptMeshName(
      getAnnotationLabel(editor, annotationId),
      annotationId
    );
    scene.add(out);
    triangleCount += positions.length / 9;
  }
  if (!scene.children.length) return null;

  try {
    const buffer = await new GLTFExporter().parseAsync(scene, { binary: true });
    return {
      blob: new Blob([buffer], { type: "model/gltf-binary" }),
      meshCount: scene.children.length,
      triangleCount,
    };
  } finally {
    scene.children.forEach((child) => child.geometry.dispose());
    material.dispose();
  }
}
