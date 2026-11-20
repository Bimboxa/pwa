import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import syncBlockOfTemplateService from "Features/blocks/services/syncBlockOfTemplateService";
import { triggerAnnotationsUpdate } from "../annotationsSlice";

export default function useCreateAnnotationTemplate() {
  const dispatch = useDispatch();

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const _listingId = useSelector((s) => s.listings.selectedListingId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const createEntity = useCreateEntity();

  return async (annotationTemplate, options) => {
    const projectId = options?.projectId ?? _projectId;
    const listingId = options?.listingId ?? _listingId;

    const _annotationTemplate = {
      ...annotationTemplate,
      id: nanoid(),
      projectId,
      listingId,
      code: getAnnotationTemplateCode({
        annotation: annotationTemplate,
        listingKey: listingId,
      }),
    };

    // BLOCK template (Features/blocks): its block is created with it (or the
    // chosen one is renamed after it) and the block's existing instances
    // join the template.
    const blockId = await syncBlockOfTemplateService({
      template: _annotationTemplate,
      scopeId,
    });
    if (blockId) _annotationTemplate.blockId = blockId;

    await createEntity(_annotationTemplate, {
      listing: { id: listingId, projectId, table: "annotationTemplates" },
    });

    dispatch(triggerAnnotationTemplatesUpdate());
    if (blockId) dispatch(triggerAnnotationsUpdate());

    return _annotationTemplate;
  };
}
