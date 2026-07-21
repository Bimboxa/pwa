import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Resolves the data backing the isoHeightLine ("Courbe de niveau") edit row
// for the currently sub-selected iso line. The selected index is encoded in
// the partId: `${annotationId}::ISO_HEIGHT_LINE::${index}`.
//
// Returns { annotation, index, isoHeightLine, height, hasIsoHeightLine, count }.
export default function useSelectedIsoHeightLineData() {
  const annotation = useSelectedAnnotation();
  const selectedItem = useSelector(selectSelectedItem);

  const parts = String(selectedItem?.partId || "").split("::");
  const index = parts[1] === "ISO_HEIGHT_LINE" ? Number(parts[2]) : -1;

  const isoHeightLines = annotation?.isoHeightLines || [];
  const isoHeightLine =
    Number.isInteger(index) && index >= 0 ? isoHeightLines[index] : null;
  const hasIsoHeightLine =
    !!isoHeightLine && (isoHeightLine.points?.length ?? 0) >= 2;
  const height = Number.isFinite(isoHeightLine?.height)
    ? isoHeightLine.height
    : 0;

  return {
    annotation,
    index,
    isoHeightLine,
    height,
    hasIsoHeightLine,
    count: isoHeightLines.length,
  };
}
