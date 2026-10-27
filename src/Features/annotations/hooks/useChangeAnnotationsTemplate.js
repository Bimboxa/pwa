import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateAnnotations from "./useUpdateAnnotations";

import getAnnotationTemplateChangeUpdates from "../utils/getAnnotationTemplateChangeUpdates";
import { isTemplateCompatibleWithAnnotation } from "./useAnnotationTemplateCandidates";

// The rows of `annotations` that may switch to `template` (same drawing
// shape — a template is a style preset, it never rebuilds the geometry).
// Pure: shared by the pickers (row suffix « · n ») and the batch change.
export function getTemplateChangeTargets(annotations, template) {
  return (annotations ?? []).filter((a) =>
    isTemplateCompatibleWithAnnotation(a, template, {
      variant: "sameType",
      currentTemplate: a.annotationTemplate ?? null,
    })
  );
}

// Batch sibling of useChangeAnnotationTemplate: applies `template` to the
// compatible rows of `annotations` (resolved rows or raw DB records) in one
// write. Diff-only patch per row (getAnnotationTemplateChangeUpdates): the
// template fields the merge actually changed, the new template's ids and
// lock set, `type` only when it changes, a templateless row becomes a regular
// listing annotation. Incompatible rows of a mixed selection are left
// untouched. Returns the number of updated rows.
export default function useChangeAnnotationsTemplate() {
  const mainBaseMap = useMainBaseMap();
  const updateAnnotations = useUpdateAnnotations();

  return async function changeAnnotationsTemplate(
    annotations,
    template,
    { baseMap } = {}
  ) {
    if (!template) return 0;
    const updates = getTemplateChangeTargets(annotations, template)
      .map((annotation) =>
        getAnnotationTemplateChangeUpdates({
          annotation,
          template,
          baseMap: baseMap ?? mainBaseMap,
        })
      )
      .filter(Boolean);
    if (updates.length > 0) await updateAnnotations(updates);
    return updates.length;
  };
}
