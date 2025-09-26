// listingKey : listingId from the listing annotation or annotationTemplateListingKey.

export default function getAnnotationTemplateCode({ annotation, listingKey }) {
  if (!annotation || !listingKey) return;

  const { type, fillColor, iconKey } = annotation;
  const id0 = listingKey;
  const id1 = "_" + type;
  const id2 = `_${fillColor ? fillColor.toUpperCase() : ""}`;
  const id3 = `_${iconKey ?? ""}`;

  return id0 + id1 + id2 + id3;
}
