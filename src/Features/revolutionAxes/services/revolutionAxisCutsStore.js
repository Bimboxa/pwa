// Module-level holder for the horizontal cuts of the revolution axes built in
// the 3D scene (mirror of revolutionAxisHandlesStore).
// ThreedRevolutionAxisHorizontalCuts publishes one entry per cut on every
// rebuild; useRevolutionAxisCutHandleDragHandlers raycasts their handles
// (Sprites, invisible to the annotation pick) and drives the preview.
//
// Entry: { axisId, handle (Sprite), z, setZ(z) (preview: plane, handle and
// contour follow), zOfWorldPoint(Vector3) (altitude of a point along the
// axis), zOfRay(Ray) (altitude of the point of the axis closest to a ray) }.

let _cuts = [];

export function setRevolutionAxisCuts(cuts) {
  _cuts = cuts || [];
}

export function getRevolutionAxisCuts() {
  return _cuts;
}
