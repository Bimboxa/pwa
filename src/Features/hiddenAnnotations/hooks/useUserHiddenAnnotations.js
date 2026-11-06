import { useSelector } from "react-redux";

import {
  selectUserHiddenAnnotationIdSet,
  selectUserHiddenFacesByAnnotationId,
} from "../hiddenAnnotationsSlice";

// What « Masquer l'annotation » currently hides, for the viewers (2D editor,
// 3D scene): both values are null when there is nothing to filter, and keep
// their identity while the registry is unchanged.
//   hiddenIdSet: Set of annotation ids hidden as a whole
//   hiddenFacesByAnnotationId: { [annotationId]: face signatures }
export default function useUserHiddenAnnotations() {
  const hiddenIdSet = useSelector(selectUserHiddenAnnotationIdSet);
  const hiddenFacesByAnnotationId = useSelector(
    selectUserHiddenFacesByAnnotationId
  );
  return { hiddenIdSet, hiddenFacesByAnnotationId };
}
