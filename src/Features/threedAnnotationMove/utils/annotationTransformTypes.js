// Annotation types whose geometry lives in db.points rows (same list as the
// 2D wrapper — POINT_BASED_TYPES in EditedObjectLayer.jsx / the wrapper
// branch of MainMapEditorV3): written through commitWrapperTransform by the
// move / rotate tools. RECTANGLE, IMAGE and POINT are out of scope.
export const POINT_BASED_ANNOTATION_TYPES = [
  "POLYLINE",
  "POLYGON",
  "STRIP",
  "LINEAR_LAYOUT",
];

export function isPointBasedAnnotationType(type) {
  return POINT_BASED_ANNOTATION_TYPES.includes(type);
}

// An imported 3D model (GLB): a BBOX annotation (bbox + rotation about the
// bbox centre + offsetZ, no db.points), moved / turned by rewriting those
// fields (getObject3DTransformUpdates); its painted parts follow
// (moveMeshPaintsWithBboxHostService).
export function isObject3DAnnotationType(type) {
  return type === "OBJECT_3D";
}

// Types the 3D « Déplacer » / « Tourner » tools carry (kind: "MOVE" |
// "ROTATE" — both accept the same types in 3D).
export function isTransformable3dType(kind, type) {
  return isPointBasedAnnotationType(type) || isObject3DAnnotationType(type);
}
