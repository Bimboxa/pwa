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
// Reference-pixel decimals for 1 mm of the plan (3 when uncalibrated): the
// geometry below stays in the model's context for the whole session.
export function millimetreDecimals(meterByPx) {
  return Number.isFinite(meterByPx) && meterByPx > 0
    ? Math.max(0, Math.ceil(Math.log10(meterByPx / 0.001)))
    : 3;
}

function roundNumbers(value, decimals) {
  if (typeof value === "number")
    return Number.isInteger(value)
      ? value
      : Math.round(value * 10 ** decimals) / 10 ** decimals;
  if (Array.isArray(value)) return value.map((v) => roundNumbers(v, decimals));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, roundNumbers(v, decimals)])
    );
  return value;
}

export function buildExistingAnnotations(
  annotations,
  listingId,
  baseMapId,
  meterByPx = null
) {
  const decimals = millimetreDecimals(meterByPx);
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
        if (a[key] != null) geometry[key] = roundNumbers(a[key], decimals);
      }
      const lockedFields = a.annotationTemplateProps?.overrideFields ?? [];
      return {
        id: a.id,
        ...(a.annotationTemplateId
          ? { annotationTemplateId: a.annotationTemplateId }
          : {}),
        type: a.type,
        label: a.label,
        isExt: a.isExt,
        strokeColor: a.strokeColor,
        fillColor: a.fillColor,
        ...(lockedFields.length ? { lockedFields } : {}),
        geometry,
      };
    });
}
