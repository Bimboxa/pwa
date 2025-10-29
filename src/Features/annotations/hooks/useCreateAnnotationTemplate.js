import { nanoid } from "@reduxjs/toolkit";

import { useSelector, useDispatch } from "react-redux";

import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import { triggerAnnotationTemplatesUpdate } from "../annotationsSlice";

import db from "App/db/db";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useCreateAnnotationTemplate() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const createEntity = useCreateEntity();

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

    await createEntity(_annotationTemplate, {
      listing: { id: listingId, projectId, table: "annotationTemplates" },
    });

    dispatch(triggerAnnotationTemplatesUpdate());
  };
}
