import selectSoloWorkPackageId from "Features/businessObjects/utils/selectSoloWorkPackageId";

// True when one of the solos useAnnotationsV2 applies is active: zone,
// business object, work package (business-objects modules only), annotation
// template, single annotation, revolution axis. Drives the bottom bar
// « style of the annotations left out » button (ButtonSoloDimStyle).
export default function selectIsAnySoloActive(s) {
  return Boolean(
    s.zonings?.soloZone ||
    s.businessObjects?.soloBusinessObjectId ||
    selectSoloWorkPackageId(s) ||
    s.annotations?.soloAnnotationTemplateId ||
    s.annotations?.soloAnnotationId ||
    s.annotations?.soloRevolutionAxisId
  );
}
