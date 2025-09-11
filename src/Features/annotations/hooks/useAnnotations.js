import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";

import db from "App/db/db";

export default function useAnnotations(options) {
  // options

  const addDemoAnnotations = options?.addDemoAnnotations;
  const filterByBaseMapId = options?.filterByBaseMapId;
  const filterByListingIds = options?.filterByListingIds;

  // data

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const editedAnnotation = useSelector((s) => s.annotations.editedAnnotation);
  const isEditingAnnotation = useSelector(
    (s) => s.annotations.isEditingAnnotation
  );

  // main

  let annotations = useLiveQuery(async () => {
    let _annotations;
    if (filterByBaseMapId) {
      _annotations = await db.annotations.toArray();
    } else {
      _annotations = await db.annotations.toArray();
    }

    // edition
    if (isEditingAnnotation) {
      _annotations = _annotations.filter((a) => a.id !== editedAnnotation.id);
      _annotations.push(editedAnnotation);
    }

    return _annotations;
  }, [annotationsUpdatedAt, isEditingAnnotation, editedAnnotation]);

  // demo

  if (addDemoAnnotations)
    annotations = [...(annotations ?? []), ...demoAnnotations];

  // return

  return annotations;
}
