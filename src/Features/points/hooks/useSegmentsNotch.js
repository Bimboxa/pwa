import useSegmentsEdgeFlag from "./useSegmentsEdgeFlag";

// State + bulk toggle for the per-segment "Bord d'ouverture" flag, stored as
// `isNotchSegmentsIdx` on the annotation main contour. The flagged segments
// outline an opening biting the contour: their vertices follow the surface of
// the polygon built without them (see applyNotchSegmentsToRing). See
// useSegmentsEdgeFlag for the full contract.
export default function useSegmentsNotch() {
  return useSegmentsEdgeFlag("isNotchSegmentsIdx");
}
