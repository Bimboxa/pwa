import { useSelector } from "react-redux";

import useAnnotations from "./useAnnotations";

export default function useAnnotationTemplateCountById() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotations = useAnnotations({ filterByProjectId: projectId });

  // main

  return annotations?.reduce((acc, annotation) => {
    acc[annotation.annotationTemplateId] =
      (acc[annotation.annotationTemplateId] || 0) + 1;
    return acc;
  }, {});
}
