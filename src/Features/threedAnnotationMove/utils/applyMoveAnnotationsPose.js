// Poses the carried annotation roots so the grabbed point lands on
// `targetWorld`. The roots are children of the base map group with their
// geometry baked in the group's LOCAL metre frame, so the move is a plain
// position offset in that frame.
// options.includeZ: when true (a real snap — VERTEX / EDGE / PLANE), the
// vertical component (plane normal) follows too, so the grabbed point lands
// EXACTLY on the target, altitude included — persisted as an offsetZ delta
// at commit. When false (free cursor), the vertical component is dropped so
// the annotations keep their altitude while sliding in the plane.
// Returns the local {x, y, z} delta (reused by the drop handler for the
// commit), or null when the group is gone.
export default function applyMoveAnnotationsPose(
  editor,
  grab,
  targetWorld,
  options = {}
) {
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (!group) return null;
  group.updateWorldMatrix(true, false);
  const local = group.worldToLocal(targetWorld.clone());
  const delta = {
    x: local.x - grab.startLocal.x,
    y: local.y - grab.startLocal.y,
    z: options.includeZ ? local.z - grab.startLocal.z : 0,
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
      start.position.z + delta.z
    );
  }
  editor.renderScene?.();
  return delta;
}
