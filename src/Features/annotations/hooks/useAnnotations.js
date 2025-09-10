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

  // main

  let annotations = useLiveQuery(async () => {
    let _annotations;
    if (filterByBaseMapId) {
      _annotations = await db.annotations.toArray();
    } else {
      _annotations = await db.annotations.toArray();
    }
    return _annotations;
  }, [annotationsUpdatedAt]);

  // demo

  if (addDemoAnnotations)
    annotations = [...(annotations ?? []), ...demoAnnotations];

  // return

  return annotations;
}
