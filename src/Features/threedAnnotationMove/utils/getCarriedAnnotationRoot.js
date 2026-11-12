import { getCutLineEntry } from "Features/threedCutLines/services/cutLineObjectsStore";

// The 3D root the « Déplacer » / « Tourner » tools pose for an annotation:
// the object the AnnotationsManager built, else the group of a cut line
// (Features/threedCutLines — rendered by ThreedCutLineAnnotations, published
// to cutLineObjectsStore). Both are children of the base map group with
// their geometry baked in its LOCAL metre frame. Always resolved by id at
// use time: a cut line group is rebuilt on every selection change.
export default function getCarriedAnnotationRoot(editor, annotationId) {
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  return (
    annotationsObjectsMap[annotationId] ??
    getCutLineEntry(annotationId)?.group ??
    null
  );
}

// Puts the carried roots of a grab back at their grab-time poses
// (grab.rootStartPoses). Does not render.
export function restoreCarriedRootPoses(editor, grab) {
  for (const id of grab?.annotationIds ?? []) {
    const root = getCarriedAnnotationRoot(editor, id);
    const start = grab.rootStartPoses.get(id);
    if (!root || !start) continue;
    root.position.copy(start.position);
    root.rotation.z = start.rotZ;
  }
}
