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

// A flat polygon used as a CUTTER (« soustraire une surface d'une autre »):
// it bounds no volume, so its operand is a wafer standing on its plane. The
// coplanar rule of the sheet carve (clipCoplanarSheetTriangles) then cuts its
// exact footprint out of a sheet host lying in the same plane — the 3D twin
// of « Évider ».
export const FLAT_SHEET_CUTTER_THICKNESS_M = 1e-4;

// What such a cutter must remove from a host to count as a contact: a sheet
// merely CROSSING the wafer loses a 0.1 mm slit, which is no contact.
export const FLAT_SHEET_MIN_REMOVED_M2 = 1e-3;

export function asFlatSheetOperand(annotation) {
  return isFlatPolygonSheet(annotation)
    ? { ...annotation, height: FLAT_SHEET_CUTTER_THICKNESS_M }
    : annotation;
}
