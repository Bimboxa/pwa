import { buildMeshDataFromWorldSoup } from "Features/threedMesh/utils/buildMeshDataFromRegion";

import collectVisibleFaceRegions from "../js/collectVisibleFaceRegions";
import getCutLinesPromptMeshName from "../utils/getCutLinesPromptMeshName";

// Face regions of the visible annotations of the 3D scene, as the input of
// buildCutLinesPromptContext: planar regions as faces ({ contour, holes,
// normal }, world meters), curved ones as a shell summary (their geometry
// only travels in the GLB mode's scene.glb).
//
// Returns [{ annotationId, label, meshName, faces? , shell? }].
export default function collectCutLinesPromptRegions({ editor, angleDeg }) {
  const sceneManager = editor?.sceneManager;
  const annotationsManager = sceneManager?.annotationsManager;
  if (!annotationsManager) return [];

  const regions = [];
  const labelById = new Map();
  for (const { annotationId, soup } of collectVisibleFaceRegions(sceneManager, {
    angleDeg,
  })) {
    const data = buildMeshDataFromWorldSoup(soup);
    if (!data) continue;
    if (!labelById.has(annotationId)) {
      labelById.set(annotationId, getAnnotationLabel(editor, annotationId));
    }
    const label = labelById.get(annotationId);
    regions.push({
      annotationId,
      label,
      meshName: getCutLinesPromptMeshName(label, annotationId),
      ...(data.shell
        ? { shell: { surface: data.shell.surface } }
        : { faces: data.faces }),
    });
  }
  return regions;
}

export function getAnnotationLabel(editor, annotationId) {
  const source =
    editor?.sceneManager?.annotationsManager?.getAnnotationSource?.(
      annotationId
    );
  return source?.label || source?.type || "Annotation";
}
