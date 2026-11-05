import isInlineExtrusionPolyline from "./isInlineExtrusionPolyline";
import isPolylineSheetWall from "./isPolylineSheetWall";

// A POLYLINE whose 3D object is an OPEN sheet built synchronously by
// createAnnotationObject3D: the PX wall (one zero-thickness quad per segment,
// isPolylineSheetWall) or the inline "Extrusion" (profileLines swept along the
// guide, isInlineExtrusionPolyline).
//
// Shared by the quantity side of the subtraction pipeline: the surface of such
// a host is a developed (lateral) surface, so what a subtraction removes is
// measured on the carved 3D mesh (computeSubtractedSurfaceM2Async), never on a
// planar footprint. A CM wall is a closed solid and is not covered here.
export default function isPolylineSheetHost(annotation) {
  return (
    isPolylineSheetWall(annotation) || isInlineExtrusionPolyline(annotation)
  );
}
