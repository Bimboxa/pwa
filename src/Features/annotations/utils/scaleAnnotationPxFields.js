// Pixel-unit size fields of an annotation must follow a uniform rescale of
// its base map frame (cross-map paste with a different meterByPx, base map
// regenerated at another dpi), otherwise a strip keeps its px width and
// changes real-world thickness. Only POLYLINE / STRIP use strokeWidth as a
// physical band width (getStripePolygons); other types use it as a stroke.
// Mutates and returns `annotation`; returns false when nothing changed.
export default function scaleAnnotationPxFields(annotation, scale) {
  if (!annotation || !Number.isFinite(scale) || scale === 1) return false;
  const type = annotation.type;
  let changed = false;
  if (type === "STRIP" || type === "POLYLINE") {
    if (
      typeof annotation.strokeWidth === "number" &&
      annotation.strokeWidthUnit !== "CM"
    ) {
      annotation.strokeWidth *= scale;
      changed = true;
    }
    if (typeof annotation.stripWidthPx === "number") {
      annotation.stripWidthPx *= scale;
      changed = true;
    }
    if (type === "STRIP" && typeof annotation.width === "number") {
      annotation.width *= scale;
      changed = true;
    }
  }
  return changed;
}
