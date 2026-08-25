// Poses the carried annotation roots for a rotation of `phi` (rad) about the
// base map plane's normal (local +Z) through the pivot. Works in the base
// map group's LOCAL frame — identical for HORIZONTAL and VERTICAL maps,
// unlike the base map rotate tool which turns around world Y. Each root's
// start pose is composed with the pivot rotation:
//   position' = pivot + Rz(phi) · (position0 − pivot),  rotation.z' = rotZ0 + phi
// Shared by the overlay (mouse-driven) and the keyboard angle buffer.
export default function applyRotateAnnotationsPose(editor, grab, phi) {
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  grab.currentPhi = phi;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const pivot = grab.pivotLocal;
  for (const id of grab.annotationIds) {
    const root = annotationsObjectsMap[id];
    const start = grab.rootStartPoses.get(id);
    if (!root || !start) continue;
    const dx = start.position.x - pivot.x;
    const dy = start.position.y - pivot.y;
    root.position.set(
      pivot.x + dx * cos - dy * sin,
      pivot.y + dx * sin + dy * cos,
      start.position.z
    );
    root.rotation.z = start.rotZ + phi;
  }
  editor.renderScene?.();
}
