// Resolve the base map group owning a snapped mesh: climb from the mesh
// (found by uuid) to the ancestor group tagged userData.kind === "baseMap"
// (the plane and the annotations are its children — see AnnotationsManager).
// Shared by the "Déplacer" and "Tourner" tools.
export default function resolveBaseMapGroupFromSnap(editor, snap) {
  const scene = editor?.sceneManager?.scene;
  const mesh = snap?.meshKey
    ? scene?.getObjectByProperty("uuid", snap.meshKey)
    : null;
  let node = mesh;
  while (node) {
    if (node.userData?.kind === "baseMap") {
      return { group: node, baseMapId: node.userData?.baseMapId ?? null };
    }
    node = node.parent;
  }
  return { group: null, baseMapId: null };
}
