import { useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function useUpdateAnnotationTemplate() {
  const dispatch = useDispatch();

  const updateEntity = useUpdateEntity();

  return async (_updates) => {
    // `hidden` is per-scope local state (scopeVisibility slice) derived onto
    // the templates at read time — callers spread whole templates, so strip
    // it rather than writing it back to the row.
    // eslint-disable-next-line no-unused-vars
    const { hidden, ...updates } = _updates;
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
