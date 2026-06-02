import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getPolygonSlope from "Features/annotations/utils/getPolygonSlope";

// Resolves the data backing the guideLine ("Ligne guide") properties panel.
//
// `slopePct` is the authoritative value stored on the annotation
// (`guideLineSlopePct`) when present, falling back to the plane-fit estimate
// (`getPolygonSlope`) so guideLines whose offsets were set via the 3D gizmo
// still display a sensible value.
//
// Returns { annotation, guidePtsPx, meterByPx, slopePct, hasGuideLine }.
export default function useSelectedGuideLineData() {
  const annotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  const guidePtsPx = annotation?.guideLine || [];
  const hasGuideLine = guidePtsPx.length >= 2;

  let slopePct = 0;
  if (annotation) {
    if (Number.isFinite(annotation.guideLineSlopePct)) {
      slopePct = annotation.guideLineSlopePct;
    } else {
      const fit = getPolygonSlope({ points: annotation.points, meterByPx });
      slopePct = fit?.slopePct ?? 0;
    }
  }

  return { annotation, guidePtsPx, meterByPx, slopePct, hasGuideLine };
}
