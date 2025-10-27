import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";

export default function useCreateAnnotationTemplate() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  return async (annotationTemplate) => {
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
    await db.annotationTemplates.add(_annotationTemplate);

    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
