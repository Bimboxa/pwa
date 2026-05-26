// Coerce numeric annotation fields that may have been persisted as strings
// (legacy data written before form inputs coerced via Number()) so the
// renderer can safely do arithmetic on them — e.g. `strokeWidth + 1` would
// otherwise concatenate as `"3" + 1 === "31"` and blow up the hover stroke.
export default function coerceAnnotationNumericFields(annotation) {
  if (!annotation) return annotation;
  const out = { ...annotation };
  if (out.strokeWidth !== undefined) out.strokeWidth = Number(out.strokeWidth);
  if (out.strokeOpacity !== undefined) out.strokeOpacity = Number(out.strokeOpacity);
  if (out.fillOpacity !== undefined) out.fillOpacity = Number(out.fillOpacity);
  return out;
}
