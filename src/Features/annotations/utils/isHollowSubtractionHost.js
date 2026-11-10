import isMesh3dClosed from "Features/annotationMesh3d/utils/isMesh3dClosed";

import {
  getShape3DKey,
  isOpenTopPrism,
  isRevolutionSolid,
} from "../constants/shape3DConfig";
import isInlineExtrusionPolyline from "./isInlineExtrusionPolyline";
import isPolylineSheetWall from "./isPolylineSheetWall";

// Whether the 3D object of a subtraction host is an OPEN surface (a sheet):
// an inline-extrusion sheet, a PX polyline wall, a « Fosse » (prism without
// its top face), an open lathe shell, or an open mesh3d. Such a host is
// clipped (HOLLOW_SUBTRACTION, no cap faces) and what a cutter removes from it
// is a surface, not a volume. Same rule as the live carve (AnnotationsManager).
export default function isHollowSubtractionHost(annotation) {
  if (!annotation) return false;
  if (annotation.isMesh3d) return !isMesh3dClosed(annotation.mesh3d);
  return (
    isInlineExtrusionPolyline(annotation) ||
    isPolylineSheetWall(annotation) ||
    isOpenTopPrism(annotation) ||
    (getShape3DKey(annotation.shape3D) === "REVOLUTION" &&
      !isRevolutionSolid(annotation))
  );
}
