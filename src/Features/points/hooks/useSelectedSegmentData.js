import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";
import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Resolves the currently sub-selected SEGMENT (edge) of the selected annotation:
// its index, optional cut index, the two endpoint points, and whether it is
// flagged as an isoHeight (contour line) segment. Mirrors useSelectedPointsData
// for the vertex panel. Returns nulls when no segment is sub-selected.
export default function useSelectedSegmentData() {
  const annotation = useSelectedAnnotation();
  const selectedItem = useSelector(selectSelectedItem);

  const partId = selectedItem?.partId;
  // partId is the authoritative source: `${annotationId}::SEG::idx` or
  // `${annotationId}::CUT_SEG::cutIdx::segIdx` (partType isn't always set on
  // the generic segment-click path).
  const parts = String(partId || "").split("::");
  const partType = parts[1];

  if (
    !annotation ||
    !partId ||
    (partType !== "SEG" && partType !== "CUT_SEG")
  ) {
    return { annotation, segIdx: null, cutIdx: null };
  }

  let cutIdx = null;
  let segIdx = null;
  if (partType === "SEG") {
    segIdx = Number(parts[2]);
  } else {
    cutIdx = Number(parts[2]);
    segIdx = Number(parts[3]);
  }
  if (!Number.isInteger(segIdx)) {
    return { annotation, segIdx: null, cutIdx: null };
  }

  const ring =
    cutIdx == null
      ? annotation.points || []
      : annotation.cuts?.[cutIdx]?.points || [];
  const n = ring.length;
  if (n < 2 || segIdx < 0 || segIdx >= n) {
    return { annotation, segIdx: null, cutIdx };
  }

  const pointA = ring[segIdx];
  const pointB = ring[(segIdx + 1) % n];

  const isoList =
    (cutIdx == null
      ? annotation.isoHeightSegmentsIdx
      : annotation.cuts?.[cutIdx]?.isoHeightSegmentsIdx) ?? [];
  const isIso = isoList.includes(segIdx);

  return { annotation, segIdx, cutIdx, pointA, pointB, isIso };
}
