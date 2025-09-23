export default function getAnnotationTemplateIdFromAnnotation(annotation) {
  if (!annotation) return;

  const { type, fillColor, iconKey } = annotation;
  const id1 = type;
  const id2 = `_${fillColor ? fillColor.toUpperCase() : ""}`;
  const id3 = `_${iconKey ?? ""}`;

  return id1 + id2 + id3;
}
