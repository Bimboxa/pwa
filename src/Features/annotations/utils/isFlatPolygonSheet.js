import { getShape3DKey } from "../constants/shape3DConfig";

// A POLYGON / RECTANGLE without height: its 3D object is a single flat face
// (a sheet), not a volume. Same test as the builder (createAnnotationObject3D
// `isSheet`), mesh3d aside — a mesh host reads its closure from its faces.
export default function isFlatPolygonSheet(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  if (!["POLYGON", "RECTANGLE"].includes(annotation.type)) return false;
  if (getShape3DKey(annotation.shape3D)) return false;
  return !((Number(annotation.height) || 0) > 0);
}
