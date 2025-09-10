import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";

import db from "App/db/db";

export default function useSelectedAnnotation(options) {
  // options

  // data

  const selectedAnnotationId = useSelector(
    (s) => s.annotations.selectedAnnotationId
  );

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // main

  let annotation = useLiveQuery(async () => {
    let _annotation = await db.annotations.get(selectedAnnotationId);

    return _annotation;
  }, [annotationsUpdatedAt, selectedAnnotationId]);

  // return

  return annotation;
}
