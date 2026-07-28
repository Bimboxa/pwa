// True for a library manifest entry that places a 3D model (a .glb) rather than
// a 2D drawing figure. Those entries carry no `tool`: they are placed with the
// ONE_CLICK / OBJECT_3D flow.
export default function isObject3DEntry(object) {
  return object?.drawingShape === "OBJECT_3D" || Boolean(object?.file3d);
}
