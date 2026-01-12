import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";

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

  const annotationTemplates = useAnnotationTemplates();

  // helper

  let selectedAnnotationId = _selectedAnnotationId;
  if (selectedNode?.nodeType === "ANNOTATION")
    selectedAnnotationId = selectedNode.nodeId;

  // main

  let annotation = useLiveQuery(async () => {
    if (!selectedAnnotationId) return null;
    let _annotation = await db.annotations.get(selectedAnnotationId);
    if (!_annotation) return null;

    // entity
    if (_annotation.entityId) {
      const listing = await db.listings.get(_annotation.listingId);
      if (listing) {
        const table = listing.table;

        let _entity = await db[table].get(_annotation.entityId);
        if (_entity) {
          const { entityWithImages, hasImages } =
            await getEntityWithImagesAsync(_entity);
          _annotation.entity = entityWithImages;
        }
      }
    }

    return _annotation;
  }, [annotationsUpdatedAt, selectedAnnotationId]);


  // template

  let template = annotationTemplates?.find(
    (t) => t.id === annotation?.annotationTemplateId
  );

  if (!annotation?.isBaseMapAnnotation) {
    annotation = { ...annotation, ...getAnnotationTemplateProps(template), templateLabel: template?.label || "-?", annotationTemplate: template };
  }

  // return

  return annotation;
}
