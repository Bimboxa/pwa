import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import createAnnotationService from "../services/createAnnotationService";

import { nanoid } from "@reduxjs/toolkit";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function useCreateAnnotation() {
  const dispatch = useDispatch();
  const { value: listing } = useSelectedListing();

  return async (annotation, options) => {
    const _annotation = {
      ...annotation,
      id: annotation?.id ?? nanoid(),
      listingId: annotation?.listingId ?? listing?.id,
    };

    await createAnnotationService(_annotation, options);
    dispatch(triggerAnnotationsUpdate());

    return _annotation;
  };
}
