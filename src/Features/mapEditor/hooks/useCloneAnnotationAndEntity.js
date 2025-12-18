import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

export default function useCloneAnnotationAndEntity() {
  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();

  const newAnnotation = useSelector((state) => state.annotations.newAnnotation);

  return async (annotation, options) => {
    // options

    const entityLabel = options?.entityLabel;

    // create entity
    const entity = await createEntity({
      label: entityLabel,
      listingId: annotation.listingId,
      projectId: annotation.projectId,
    });

    // create annotation

    const clonedAnnotation = {
      ...annotation,
      ...newAnnotation,
      id: nanoid(),
      entityId: entity?.id,
    };

    if (annotation.type === "POLYGON" && newAnnotation.type === "POLYLINE") {
      clonedAnnotation.closeLine = true;
    }

    const _annotation = await createAnnotation(clonedAnnotation);

    return _annotation;
  };
}
