import useSegmentsEdgeFlag from "./useSegmentsEdgeFlag";

// State + bulk toggle for the per-segment "Segment extérieur" flag, stored as
// `isExtEdgeSegmentsIdx` on the annotation main contour and on each
// `annotation.cuts[cutIdx]`. Mutually exclusive with the "Segment intérieur"
// flag (`isIntEdgeSegmentsIdx`). See useSegmentsEdgeFlag for the full contract.
export default function useSegmentsExtEdge() {
  return useSegmentsEdgeFlag("isExtEdgeSegmentsIdx", "isIntEdgeSegmentsIdx");
}
