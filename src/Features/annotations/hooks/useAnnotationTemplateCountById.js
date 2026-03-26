import useAnnotationsV2 from "./useAnnotationsV2";

export default function useAnnotationTemplateCountById({ filterByBaseMapId } = {}) {
  // data

  const annotations = useAnnotationsV2({ caller: "useAnnotationTemplateCountById" });

  // main

  return annotations?.reduce((acc, annotation) => {
    if (filterByBaseMapId && annotation.baseMapId !== filterByBaseMapId) return acc;
    acc[annotation.annotationTemplateId] =
      (acc[annotation.annotationTemplateId] || 0) + 1;
    return acc;
  }, {});
}
