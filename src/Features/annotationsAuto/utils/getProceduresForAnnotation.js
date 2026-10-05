// ANNOTATIONS_CREATOR procedures an annotation can be the source of:
// - the procedures linked by its template (template.procedureKeys);
// - the registry entries that declare its TYPE as a template-less source
//   (entry.sourceAnnotationTypes — e.g. a REVOLUTION_AXIS, which belongs to a
//   base map + scope and carries no template).
export default function getProceduresForAnnotation(annotation, procedures) {
  if (!annotation) return [];
  const all = (procedures ?? []).filter(
    (p) => p?.type === "ANNOTATIONS_CREATOR"
  );
  const templateKeys = annotation.annotationTemplate?.procedureKeys ?? [];
  return all.filter(
    (p) =>
      templateKeys.includes(p.key) ||
      (p.sourceAnnotationTypes ?? []).includes(annotation.type)
  );
}
