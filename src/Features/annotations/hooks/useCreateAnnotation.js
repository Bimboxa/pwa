import { useDispatch, useSelector } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import createAnnotationService from "../services/createAnnotationService";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useCreateAnnotation() {
  const dispatch = useDispatch();
  const { value: listing } = useSelectedListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async (annotation, options) => {
    const _annotation = {
      ...annotation,
      id: nanoid(),
      projectId,
      listingId: annotation?.listingId ?? listing?.id,
    };

    if (annotation.isScaleSegment) {
      _annotation.listingId = null;
    }

    await createAnnotationService(_annotation, options);
    dispatch(triggerAnnotationsUpdate());
    dispatch(triggerAnnotationTemplatesUpdate());

    return _annotation;
  };
}
