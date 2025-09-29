import getAnnotationTemplateCode from "./getAnnotationTemplateCode";

export default function getAnnotationTemplateFromAnnotation({
  annotation,
  listing,
  annotationTemplates,
}) {
  const listingKey_1 = listing?.id;
  const listingKey_2 = listing?.annotationTemplatesListingKey;

  const code_1 = getAnnotationTemplateCode({
    annotation,
    listingKey: listingKey_1,
  });
  const code_2 = getAnnotationTemplateCode({
    annotation,
    listingKey: listingKey_2,
  });

  const t1 = annotationTemplates?.find(({ code }) => code === code_1);
  const t2 = annotationTemplates?.find(({ code }) => code === code_2);

  return t1 || t2;
}
