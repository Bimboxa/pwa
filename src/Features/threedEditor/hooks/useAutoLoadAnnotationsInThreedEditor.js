import { useEffect } from "react";
import { useSelector } from "react-redux";

import useAnnotations from "Features/annotations/hooks/useAnnotations";

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const annotations = useAnnotations({
    filterByBaseMapId: selectedBaseMapId,
    withEntity: false,
    withLabel: false,
  });

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  useEffect(() => {
    if (
      threedEditor?.loadAnnotations &&
      rendererIsReady &&
      annotations?.length > 0
    ) {
      // Filter annotations to only include those with the required properties
      const validAnnotations = annotations.filter(
        (annotation) =>
          annotation &&
          annotation.type &&
          (annotation.x !== undefined || annotation.points) &&
          annotation.baseMapId
      );

      if (validAnnotations.length > 0) {
        threedEditor.loadAnnotations(validAnnotations);
      }
    }
  }, [
    rendererIsReady,
    annotationsUpdatedAt,
    annotations,
    selectedBaseMapId,
    threedEditor,
  ]);
}
