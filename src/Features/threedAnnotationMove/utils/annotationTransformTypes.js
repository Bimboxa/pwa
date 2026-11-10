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

// Annotations PLACED by a bbox (no db.points): an imported 3D model, or an
// instance of a block (Features/blocks — zero-size anchor bbox). Both are
// moved / turned by rewriting bbox / rotation / offsetZ
// (getObject3DTransformUpdates).
export function isBboxPlacedAnnotationType(type) {
  return isObject3DAnnotationType(type) || type === "BLOCK_INSTANCE";
}

// Types the 3D « Déplacer » / « Tourner » tools carry (kind: "MOVE" |
// "ROTATE" — both accept the same types in 3D).
export function isTransformable3dType(kind, type) {
  return isPointBasedAnnotationType(type) || isBboxPlacedAnnotationType(type);
}
