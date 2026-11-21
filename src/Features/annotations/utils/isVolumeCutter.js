import { isInvertedUWall, isOpenTopPrism } from "../constants/shape3DConfig";
import isFlatPolygonSheet from "./isFlatPolygonSheet";
import isHollowSubtractionHost from "./isHollowSubtractionHost";

// What can carve: the annotation types that build a volume in 3D.
export const CUTTER_TYPES = ["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"];

// An open sheet bounds no volume: it cannot carve. A « Fosse » / « U inversé »
// is carved as its closed solid (asClosedSolidOperand), so it stays a valid
// cutter.
export default function isVolumeCutter(annotation) {
  return (
    isOpenTopPrism(annotation) ||
    isInvertedUWall(annotation) ||
    !isHollowSubtractionHost(annotation)
  );
}

// What « soustraire au contact » accepts as a cutter: a volume, or a flat
// polygon — which only cuts SHEET hosts lying in its plane (see
// asFlatSheetOperand, getHostsCutByAnnotationAsync).
export function isContactCutter(annotation) {
  return isVolumeCutter(annotation) || isFlatPolygonSheet(annotation);
}
