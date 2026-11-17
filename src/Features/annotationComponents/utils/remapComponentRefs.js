// Id remapping of the component references when rows are copied with new ids
// (scope duplication, listing copy). An id missing from a map is kept as is.

// Fields to lay over the copy of a template: `componentItems` with the ids
// of the copied templates. Empty object for a non-component template.
export function remapComponentTemplateRefs(template, templateIdMap) {
  if (!Array.isArray(template?.componentItems)) return {};
  return {
    componentItems: template.componentItems.map((item) =>
      item?.annotationTemplateId
        ? {
            ...item,
            annotationTemplateId:
              templateIdMap?.[item.annotationTemplateId] ??
              item.annotationTemplateId,
          }
        : item
    ),
  };
}

// Fields to lay over the copy of an annotation: the source / template refs
// of a child, the per-template enabled map of a source.
export function remapComponentAnnotationRefs(
  annotation,
  { templateIdMap, annotationIdMap }
) {
  const next = {};
  if (annotation?.componentSourceAnnotationId)
    next.componentSourceAnnotationId =
      annotationIdMap?.[annotation.componentSourceAnnotationId] ??
      annotation.componentSourceAnnotationId;
  if (annotation?.componentElementKey)
    next.componentElementKey =
      templateIdMap?.[annotation.componentElementKey] ??
      annotation.componentElementKey;
  if (annotation?.componentItemsEnabled)
    next.componentItemsEnabled = Object.fromEntries(
      Object.entries(annotation.componentItemsEnabled).map(([id, enabled]) => [
        templateIdMap?.[id] ?? id,
        enabled,
      ])
    );
  return next;
}
