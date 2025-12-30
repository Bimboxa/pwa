import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";

export default function useCreateAnnotationTemplate() {
  const dispatch = useDispatch();

  // data

  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const _listingId = useSelector((s) => s.listings.selectedListingId);

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

    await createEntity(_annotationTemplate, {
      listing: { id: listingId, projectId, table: "annotationTemplates" },
    });

    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
