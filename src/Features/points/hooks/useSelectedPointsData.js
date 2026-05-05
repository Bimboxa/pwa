import { useSelector } from "react-redux";

import { selectSelectedPointIds } from "Features/selection/selectionSlice";
import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Returns the points (across the contour and any cut) of the currently selected
// annotation that are also in selectedPointIds, plus a `mixed` map indicating
// which fields differ across the selected points (used by PanelPropertiesPoints
// to display "Mixte" placeholders when several points have divergent values).
export default function useSelectedPointsData() {
  const annotation = useSelectedAnnotation();
  const selectedPointIds = useSelector(selectSelectedPointIds);

  if (!annotation || !selectedPointIds?.length) {
    return { annotation, selectedPoints: [], mixed: {} };
  }

  const idSet = new Set(selectedPointIds);
  const allPoints = [
    ...(annotation.points || []),
    ...((annotation.cuts || []).flatMap((c) => c?.points || [])),
    ...(annotation.innerPoints || []),
  ];
  const selectedPoints = allPoints.filter((p) => idSet.has(p.id));

  const fields = ["type", "offsetBottom", "offsetTop"];
  const mixed = {};
  for (const f of fields) {
    if (selectedPoints.length <= 1) {
      mixed[f] = false;
    } else {
      const first = selectedPoints[0]?.[f];
      mixed[f] = selectedPoints.some((p) => p?.[f] !== first);
    }
  }

  return { annotation, selectedPoints, mixed };
}
