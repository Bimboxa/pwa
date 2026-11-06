import useSegmentsEdgeFlag from "./useSegmentsEdgeFlag";

// State + bulk toggle for the per-segment "Extrusion plate" flag, stored as
// `isFlatExtrusionSegmentsIdx` on the annotation main contour. On a POLYLINE
// carrying an inline profile (profileLines), the flagged segments sweep the
// profile's first → last chord instead of the full cross-section; the 3D
// build closes the holes at the profiled ↔ flat junctions (see
// sweepFlatJunction.js). See useSegmentsEdgeFlag for the full contract.
export default function useSegmentsFlatExtrusion() {
  return useSegmentsEdgeFlag("isFlatExtrusionSegmentsIdx");
}
