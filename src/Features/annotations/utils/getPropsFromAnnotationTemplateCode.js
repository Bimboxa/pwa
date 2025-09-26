export default function getPropsFromAnnotationTemplateCode(
  annotationTemplateCode
) {
  if (!annotationTemplateCode) return {};

  const [listingKey, type, fillColor, iconKey] =
    annotationTemplateCode.split("_");

  return { listingKey, type, fillColor, iconKey };
}
