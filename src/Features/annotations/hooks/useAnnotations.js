import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";

import db from "App/db/db";

export default function useAnnotations(options) {
  // options

  const addDemoAnnotations = options?.addDemoAnnotations;
  const filterByBaseMapId = options?.filterByBaseMapId;
  const filterByListingId = options?.filterByListingId;
  const addBgImageTextAnnotations = options?.addBgImageTextAnnotations;

  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );
  const bgImageTextAnnotations = useBgImageTextAnnotations();

  // main

  let annotations = useLiveQuery(async () => {
    let _annotations;
    if (filterByBaseMapId) {
      _annotations = await db.annotations
        .where("baseMapId")
        .equals(filterByBaseMapId)
        .toArray();
    } else {
      _annotations = await db.annotations.toArray();
    }

    if (filterByListingId) {
      _annotations = _annotations.filter(
        (a) => filterByListingId === a.listingId
      );
    }

    // edition
    if (isEditingAnnotation) {
      _annotations = _annotations.filter((a) => a.id !== editedAnnotation.id);
      _annotations.push(editedAnnotation);
    }

    return _annotations;
  }, [
    annotationsUpdatedAt,
    isEditingAnnotation,
    editedAnnotation,
    filterByListingId,
    filterByBaseMapId,
  ]);

  // demo

  if (addDemoAnnotations)
    annotations = [...(annotations ?? []), ...demoAnnotations];

  if (addBgImageTextAnnotations) {
    annotations = [...(annotations ?? []), ...bgImageTextAnnotations];
  }

  // return

  return annotations;
}
