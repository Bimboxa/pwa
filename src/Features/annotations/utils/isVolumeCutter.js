import { isInvertedUWall, isOpenTopPrism } from "../constants/shape3DConfig";
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
