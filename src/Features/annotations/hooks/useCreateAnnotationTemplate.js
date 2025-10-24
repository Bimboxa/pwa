import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import db from "App/db/db";

import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";

export default function useCreateAnnotationTemplate() {
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
  };
}
