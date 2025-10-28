import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function useUpdateAnnotationTemplate() {
  const dispatch = useDispatch();

  const updateEntity = useUpdateEntity();

  return async (updates) => {
    const options = {
      listing: {
        id: updates.listingId,
        table: "annotationTemplates",
        projectId: updates.projectId,
      },
    };
    await updateEntity(updates.id, updates, options);

    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
