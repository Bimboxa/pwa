import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import demoAnnotations from "../data/demoAnnotations";

import db from "App/db/db";

export default function useSelectedAnnotation() {
  // options

  // data

  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);
  const _selectedAnnotationId = useSelector(
    (s) => s.annotations.selectedAnnotationId
  );

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // helper

  let selectedAnnotationId = _selectedAnnotationId;
  if (selectedNode?.nodeType === "ANNOTATION")
    selectedAnnotationId = selectedNode.id;

  // main

  let annotation = useLiveQuery(async () => {
    if (!selectedAnnotationId) return null;
    let _annotation = await db.annotations.get(selectedAnnotationId);

    return _annotation;
  }, [annotationsUpdatedAt, selectedAnnotationId]);

  // return

  return annotation;
}
