// Module-level holder of the clip box faces built in the 3D scene (mirror of
// revolutionAxisCutsStore): ThreedBaseMapClipBoxes publishes one entry per
// face on every rebuild; useBaseMapClipBoxDragHandlers raycasts their
// handles (Sprites, invisible to the annotation pick) and drives the
// preview.
//
// Entry: { baseMapId, side ("front" | "back"), handles (4 Sprites, one per
// corner), depth (metres from the base map plane, ≥ 0), setDepth(depth)
// (preview: the face, its handles, the box edges and the live clipping
// plane follow), depthOfWorldPoint(Vector3), depthOfRay(Ray, handle) (depth
// of the point, on the normal through the handle's corner, closest to the
// ray) }.

let _faces = [];

export function setBaseMapClipBoxFaces(faces) {
  _faces = faces || [];
}

export function getBaseMapClipBoxFaces() {
  return _faces;
}
