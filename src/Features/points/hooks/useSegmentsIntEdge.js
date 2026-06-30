import useSegmentsEdgeFlag from "./useSegmentsEdgeFlag";

// State + bulk toggle for the per-segment "Segment intérieur" flag, stored as
// `isIntEdgeSegmentsIdx` on the annotation main contour and on each
// `annotation.cuts[cutIdx]`. Mutually exclusive with the "Segment extérieur"
// flag (`isExtEdgeSegmentsIdx`). In "Cuvelage auto" it pins tagged segments to
// the interior (VI) classification, repairing bad auto-detections. See
// useSegmentsEdgeFlag for the full contract.
export default function useSegmentsIntEdge() {
  return useSegmentsEdgeFlag("isIntEdgeSegmentsIdx", "isExtEdgeSegmentsIdx");
}
