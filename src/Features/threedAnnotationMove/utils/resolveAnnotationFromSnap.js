// Resolve the annotation owning a snapped mesh: climb from the mesh (found
// by uuid) to the ancestor tagged userData.nodeType === "ANNOTATION" (the
// annotation root object), and keep climbing to the base map group
// (userData.kind === "baseMap") the root is parented to. Same pattern as
// resolveBaseMapGroupFromSnap, with the annotation predicate.
export default function resolveAnnotationFromSnap(editor, snap) {
  const scene = editor?.sceneManager?.scene;
  const mesh = snap?.meshKey
    ? scene?.getObjectByProperty("uuid", snap.meshKey)
    : null;
  let node = mesh;
  let annotationRoot = null;
  let group = null;
  while (node) {
    if (!annotationRoot && node.userData?.nodeType === "ANNOTATION") {
      annotationRoot = node;
    }
    if (node.userData?.kind === "baseMap") {
      group = node;
      break;
    }
    node = node.parent;
  }
  const userData = annotationRoot?.userData ?? {};
  return {
    annotationRoot,
    annotationId: userData.nodeId ?? null,
    annotationType: userData.annotationType ?? null,
    listingId: userData.listingId ?? null,
    annotationTemplateId: userData.annotationTemplateId ?? null,
    baseMapId: userData.baseMapId ?? group?.userData?.baseMapId ?? null,
    group,
  };
}
