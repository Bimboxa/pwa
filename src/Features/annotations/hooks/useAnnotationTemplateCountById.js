import useAnnotationsV2 from "./useAnnotationsV2";

export default function useAnnotationTemplateCountById() {
  // data

  const annotations = useAnnotationsV2();

  // main

  return annotations?.reduce((acc, annotation) => {
    acc[annotation.annotationTemplateId] =
      (acc[annotation.annotationTemplateId] || 0) + 1;
    return acc;
  }, {});
}
