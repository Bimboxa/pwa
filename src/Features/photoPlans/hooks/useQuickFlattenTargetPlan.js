import { useSelector } from "react-redux";

import usePhotoPlans from "./usePhotoPlans";

// The photoPlan targeted by the quick-flatten flow (Transfo. tool section +
// guide-lines layer): the plan selected in the map-editor chips band when it
// belongs to the displayed photo (a "découpe" zone plan, typically), else
// the whole-photo plan. Null when the photo has no plan yet.
export default function useQuickFlattenTargetPlan({ baseMap }) {
  const selectedId = useSelector((s) => s.photoPlans.selectedPhotoPlanIdInMap);
  const { value: photoPlans = [] } = usePhotoPlans({
    baseMapId: baseMap?.isPhoto ? baseMap.id : null,
  });
  return (
    photoPlans.find((p) => p.id === selectedId) ??
    photoPlans.find((p) => !p.annotationId) ??
    null
  );
}
