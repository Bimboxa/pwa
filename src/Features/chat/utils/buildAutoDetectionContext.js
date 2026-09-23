// Keep only persisted models belonging to the selected listing. Legend visibility
// is independent of map visibility: hiddenInLegend must not exclude a model.
export function getVisibleListingTemplates(templates, listingId) {
  return (templates ?? []).filter(
    (t) =>
      listingId &&
      t.id &&
      t.listingId === listingId &&
      !t.deletedAt &&
      !t.hidden
  );
}

// useAnnotationsV2 has already resolved the geometry to reference pixels and
// applied the map visibility filters. Never send entities, images or DB refs.
export function buildExistingAnnotations(annotations, listingId, baseMapId) {
  return (annotations ?? [])
    .filter(
      (a) =>
        a.listingId === listingId &&
        a.baseMapId === baseMapId &&
        !a.hidden &&
        !a.deletedAt
    )
    .map((a) => {
      const geometry = {};
      for (const key of [
        "point",
        "points",
        "cuts",
        "openings",
        "guideLines",
        "isOpening",
        "openingType",
        "offsetZ",
        "innerPoints",
        "closeLine",
        "radius",
        "rx",
        "ry",
        "rotation",
        "width",
        "height",
        "strokeWidth",
        "strokeWidthUnit",
        "stripOrientation",
        "text",
      ]) {
        if (a[key] != null) geometry[key] = a[key];
      }
      return {
        id: a.id,
        ...(a.annotationTemplateId
          ? { annotationTemplateId: a.annotationTemplateId }
          : {}),
        type: a.type,
        geometry,
      };
    });
}
