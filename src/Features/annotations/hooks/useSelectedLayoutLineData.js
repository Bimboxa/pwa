import { useMemo } from "react";
import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import computeLayoutLineBars, {
  getLayoutLineRingsPx,
  LAYOUT_LINE_DEFAULTS,
} from "Features/annotations/utils/computeLayoutLineBars";

// Resolves the data backing the layoutLine ("Ligne de calepinage")
// properties panel / toolbar row for the currently sub-selected layoutLine.
// The selected index is encoded in the partId:
// `${annotationId}::LAYOUT_LINE::${index}`.
//
// Returns { annotation, index, layoutLine, hasLayoutLine, count, meterByPx,
// layout } where `layout` is the computeLayoutLineBars result (bars, totals).
export default function useSelectedLayoutLineData() {
  const annotation = useSelectedAnnotation();
  const selectedItem = useSelector(selectSelectedItem);
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  const parts = String(selectedItem?.partId || "").split("::");
  const index = parts[1] === "LAYOUT_LINE" ? Number(parts[2]) : -1;

  const layoutLines = annotation?.layoutLines || [];
  const rawLine =
    Number.isInteger(index) && index >= 0 ? layoutLines[index] : null;
  const layoutLine = rawLine ? { ...LAYOUT_LINE_DEFAULTS, ...rawLine } : null;
  const hasLayoutLine = !!layoutLine && (layoutLine.points?.length ?? 0) >= 2;

  const layout = useMemo(() => {
    if (!hasLayoutLine || annotation?.type !== "POLYGON") return null;
    const { outerRing, cutRings } = getLayoutLineRingsPx(annotation);
    return computeLayoutLineBars({
      linePoints: layoutLine.points,
      outerRing,
      cutRings,
      meterByPx,
      densityMode: layoutLine.densityMode,
      densityValue: layoutLine.densityValue,
      layoutAlign: layoutLine.layoutAlign,
      coverWholeSurface: layoutLine.coverWholeSurface,
    });
  }, [annotation, hasLayoutLine, layoutLine, meterByPx]);

  return {
    annotation,
    index,
    layoutLine,
    hasLayoutLine,
    count: layoutLines.length,
    meterByPx,
    layout,
  };
}
