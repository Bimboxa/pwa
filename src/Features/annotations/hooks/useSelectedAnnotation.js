import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";

import db from "App/db/db";
import useAnnotationsV2 from "./useAnnotationsV2";

export default function useSelectedAnnotation() {
  // options

  // data

  // withForeignFootprints: a footprint (subtraction target hosted by another
  // base map) is selectable on the plan, so the toolbar must be able to
  // resolve it — otherwise selecting one shows no toolbar at all.
  const annotations = useAnnotationsV2({
    caller: "useSelectedAnnotation",
    withForeignFootprints: true,
  })

  // const selectedNode = useSelector((s) => s.mapEditor.selectedNode); // Removed
  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];

  const _selectedAnnotationId = useSelector(
    (s) => s.annotations.selectedAnnotationId
  );

  const annotationTemplates = useAnnotationTemplates();

  // helper

  let selectedAnnotationId = _selectedAnnotationId;
  // If we have a selected item in the new slice, prioritize it
  if (selectedItem?.nodeType === "ANNOTATION") {
    selectedAnnotationId = selectedItem.nodeId;
  } else if (selectedItem?.context === "BG_IMAGE" || selectedItem?.nodeType === "BG_IMAGE_TEXT") {
    // Handle other types if they map to annotations
    selectedAnnotationId = selectedItem.nodeId;
  }

  // A selected label ("label::<id>") resolves to its annotation, so the
  // properties panel shows the annotation (Etiquette tab opened by the
  // selection reducer).
  if (selectedAnnotationId?.startsWith?.("label::")) {
    selectedAnnotationId = selectedAnnotationId.replace("label::", "");
  }

  // existing fallback or logic


  // main
  // let annotation = useLiveQuery(async () => {
  //   if (!selectedAnnotationId) return null;
  //   let _annotation = await db.annotations.get(selectedAnnotationId);
  //   if (!_annotation) return null;

  //   // entity
  //   if (_annotation.entityId) {
  //     const listing = await db.listings.get(_annotation.listingId);
  //     if (listing) {
  //       const table = listing.table;

  //       let _entity = await db[table].get(_annotation.entityId);
  //       if (_entity) {
  //         const { entityWithImages, hasImages } =
  //           await getEntityWithImagesAsync(_entity);
  //         _annotation.entity = entityWithImages;
  //       }
  //     }
  //   }

  //   return _annotation;
  // }, [annotationsUpdatedAt, selectedAnnotationId]);

  let annotation = annotations?.find(a => a.id === selectedAnnotationId)

  // template

  let template = annotationTemplates?.find(
    (t) => t.id === annotation?.annotationTemplateId
  );

  // No annotation resolved for the selected id (e.g. just deleted, or not yet
  // loaded): return null so the toolbar hides instead of rendering a hollow
  // "-?" row that looks like a corrupted annotation.
  if (!annotation) return null;

  if (!annotation.isBaseMapAnnotation) {
    annotation = { ...annotation, templateLabel: template?.label || "-?", annotationTemplate: template };
  }

  // return

  return annotation;
}
