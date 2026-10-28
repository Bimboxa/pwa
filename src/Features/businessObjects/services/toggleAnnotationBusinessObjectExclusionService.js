import db from "App/db/db";

import setBusinessObjectAnnotationExclusionsService from "./setBusinessObjectAnnotationExclusionsService";
import {
  isAnnotationExcluded,
  isExclusionApplicable,
} from "../utils/excludedAnnotationIds";

// Exclusion picking mode: one click on an annotation of a template linked by
// template excludes it from the object's quantity, a second click re-includes
// it. An annotation whose template is not linked by template is skipped (an
// exclusion would have no effect — nothing is ever subtracted from a per
// annotation link).
// Returns "excluded" | "included" | "skipped".
export default async function toggleAnnotationBusinessObjectExclusionService({
  businessObject,
  annotationId,
}) {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation || annotation.deletedAt) return "skipped";
  if (!isExclusionApplicable(businessObject, annotation)) return "skipped";

  const excluded = isAnnotationExcluded(businessObject, annotationId);
  await setBusinessObjectAnnotationExclusionsService({
    businessObject,
    annotationIds: [annotationId],
    excluded: !excluded,
  });
  return excluded ? "included" : "excluded";
}
