// Resolve the rendered stroke/band width in reference-image pixels.
export default function getAnnotationStrokeWidthPx(annotation, meterByPx) {
  const width =
    annotation?.strokeWidth ?? (annotation?.type === "STRIP" ? 20 : 1);
  return annotation?.strokeWidthUnit === "CM" && meterByPx > 0
    ? (width * 0.01) / meterByPx
    : width;
}
