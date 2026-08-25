// Annotation types the 3D move/rotate tools can transform: the ones whose
// geometry lives in db.points rows (same list as the 2D wrapper —
// POINT_BASED_TYPES in EditedObjectLayer.jsx / the wrapper branch of
// MainMapEditorV3). Bbox types (RECTANGLE, IMAGE, OBJECT_3D) and POINT are
// out of scope for now.
export const POINT_BASED_ANNOTATION_TYPES = [
  "POLYLINE",
  "POLYGON",
  "STRIP",
  "LINEAR_LAYOUT",
];

export function isPointBasedAnnotationType(type) {
  return POINT_BASED_ANNOTATION_TYPES.includes(type);
}
