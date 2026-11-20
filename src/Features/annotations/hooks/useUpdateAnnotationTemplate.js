import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationTemplatesUpdate,
  triggerAnnotationsUpdate,
} from "../annotationsSlice";

import syncBlockOfTemplateService from "Features/blocks/services/syncBlockOfTemplateService";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function useUpdateAnnotationTemplate() {
  const dispatch = useDispatch();

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const updateEntity = useUpdateEntity();

  return async (_updates) => {
    // `hidden` is per-scope local state (scopeVisibility slice) derived onto
    // the templates at read time — callers spread whole templates, so strip
    // it rather than writing it back to the row.
    // eslint-disable-next-line no-unused-vars
    const { hidden, ...updates } = _updates;
    // BLOCK template (Features/blocks): its block follows (created when the
    // template just became a BLOCK one, renamed with it).
    const blockId = await syncBlockOfTemplateService({
      template: updates,
      scopeId,
    });
    if (blockId) updates.blockId = blockId;
    const options = {
      listing: {
        id: updates.listingId,
        table: "annotationTemplates",
        projectId: updates.projectId,
      },
    };
    await updateEntity(updates.id, updates, options);

    dispatch(triggerAnnotationTemplatesUpdate());
    if (blockId) dispatch(triggerAnnotationsUpdate());
  };
}
