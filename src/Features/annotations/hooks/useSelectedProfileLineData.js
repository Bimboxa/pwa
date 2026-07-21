import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Resolves the data backing the profileLine ("Profil") edit row for the
// currently sub-selected profile line. The selected index is encoded in the
// partId: `${annotationId}::PROFILE_LINE::${index}`.
//
// Returns { annotation, index, profileLine, hasProfileLine, count }.
export default function useSelectedProfileLineData() {
  const annotation = useSelectedAnnotation();
  const selectedItem = useSelector(selectSelectedItem);

  const parts = String(selectedItem?.partId || "").split("::");
  const index = parts[1] === "PROFILE_LINE" ? Number(parts[2]) : -1;

  const profileLines = annotation?.profileLines || [];
  const profileLine =
    Number.isInteger(index) && index >= 0 ? profileLines[index] : null;
  const hasProfileLine =
    !!profileLine && (profileLine.points?.length ?? 0) >= 2;

  return {
    annotation,
    index,
    profileLine,
    hasProfileLine,
    count: profileLines.length,
  };
}
