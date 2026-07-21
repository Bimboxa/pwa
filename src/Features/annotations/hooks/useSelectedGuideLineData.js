import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Resolves the data backing the guideLine ("Ligne guide") properties panel for
// the currently sub-selected guideLine. The selected index is encoded in the
// partId: `${annotationId}::GUIDE_LINE::${index}`.
//
// Returns { annotation, index, guideLine, slopePct, hasGuideLine, count }.
export default function useSelectedGuideLineData() {
  const annotation = useSelectedAnnotation();
  const selectedItem = useSelector(selectSelectedItem);

  const parts = String(selectedItem?.partId || "").split("::");
  const index = parts[1] === "GUIDE_LINE" ? Number(parts[2]) : -1;

  const guideLines = annotation?.guideLines || [];
  const guideLine =
    Number.isInteger(index) && index >= 0 ? guideLines[index] : null;
  const hasGuideLine = !!guideLine && (guideLine.points?.length ?? 0) >= 2;
  const slopePct = Number.isFinite(guideLine?.slopePct)
    ? guideLine.slopePct
    : 0;
  const isStairs = Boolean(guideLine?.isStairs);
  const stairsCount =
    Number.isFinite(guideLine?.stairsCount) && guideLine.stairsCount >= 1
      ? Math.round(guideLine.stairsCount)
      : 1;

  return {
    annotation,
    index,
    guideLine,
    slopePct,
    isStairs,
    stairsCount,
    hasGuideLine,
    count: guideLines.length,
  };
}
