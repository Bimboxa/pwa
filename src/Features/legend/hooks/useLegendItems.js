import { useSelector } from "react-redux";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotations from "Features/annotations/hooks/useAnnotations";

import useListings from "Features/listings/hooks/useListings";

import db from "App/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getAnnotationTemplateIdFromAnnotation from "Features/annotations/utils/getAnnotationTemplateIdFromAnnotation";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useLegendItems() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listings = useListings({ filterByProjectId: projectId });
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const annotationTemplates = useAnnotationTemplates();
  const annotations = useAnnotations({
    filterByBaseMapId: baseMapId,
  });

  // helpers - annotationTemplateById

  const annotationTemplateById = getItemsByKey(annotationTemplates, "id");

  // helpers

  let legendItems = [];
  const idsMap = {};

  annotations?.forEach((annotation) => {
    const templateId = annotation.annotationTemplateId;
    const template = annotationTemplateById[templateId];
    if (!idsMap[templateId]) {
      idsMap[templateId] = annotation;
      const { iconKey, fillColor } = annotation;
      legendItems.push({
        id: templateId,
        iconKey,
        fillColor,
        label: template?.label ?? "A définir",
      });
    }
  });

  // sort

  legendItems = legendItems.sort((a, b) => a.label.localeCompare(b.label));

  // render

  return legendItems;
}
