// Poses the carried annotation roots so the grabbed point lands on
// `targetWorld`. The roots are children of the base map group with their
// geometry baked in the group's LOCAL metre frame, so the move is a plain
// position offset in that frame. The local Z component (plane normal) is
// dropped: the transform stays in the base map plane, hence committable as
// 2D point coordinates. Returns the local {x, y} delta (reused by the drop
// handler for the commit), or null when the group is gone.
export default function applyMoveAnnotationsPose(editor, grab, targetWorld) {
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (!group) return null;
  group.updateWorldMatrix(true, false);
  const local = group.worldToLocal(targetWorld.clone());
  const delta = {
    x: local.x - grab.startLocal.x,
    y: local.y - grab.startLocal.y,
  };
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  for (const id of grab.annotationIds) {
    const root = annotationsObjectsMap[id];
    const start = grab.rootStartPoses.get(id);
    if (!root || !start) continue;
    root.position.set(
      start.position.x + delta.x,
      start.position.y + delta.y,
      start.position.z
    );
  }
  editor.renderScene?.();
  return delta;
}
