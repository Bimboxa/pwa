export default function getAnnotationTemplateCode({ annotation, listing }) {
  if (!annotation || listing) return;

  const { type, fillColor, iconKey } = annotation;
  const id0 = listing?.key;
  const id1 = "_" + type;
  const id2 = `_${fillColor ? fillColor.toUpperCase() : ""}`;
  const id3 = `_${iconKey ?? ""}`;

  return id0 + id1 + id2 + id3;
}
