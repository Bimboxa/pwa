import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { getDefaultsForShape } from "../constants/drawingShapeConfig";
import getAnnotationTemplateCode from "../utils/getAnnotationTemplateCode";

// Finds the DETAIL annotationTemplate of a listing dedicated to a detail
// baseMap, or creates it. One template per detail: its label is the detail
// name (the name typed in the "Nouveau fond de plan de détail" dialog).
// Lookup by the template's detailBaseMapId link first (survives a rename of
// the template or of the baseMap), then by label. Returns the template
// record, or null when the listing / label is missing.
export default async function findOrCreateDetailAnnotationTemplate({
  listingId,
  projectId,
  label,
  detailBaseMapId = null,
}) {
  const _label = label?.trim();
  if (!listingId || !_label) return null;

  const templates = (
    await db.annotationTemplates.where("listingId").equals(listingId).toArray()
  ).filter((t) => !t.deletedAt && t.drawingShape === "DETAIL");

  const existing =
    (detailBaseMapId &&
      templates.find((t) => t.detailBaseMapId === detailBaseMapId)) ||
    templates.find((t) => !t.detailBaseMapId && t.label?.trim() === _label);
  if (existing) return existing;

  const { fillColor } = getDefaultsForShape("DETAIL");
  const template = {
    id: nanoid(),
    projectId,
    listingId,
    label: _label,
    drawingShape: "DETAIL",
    fillColor,
    overrideFields: [],
    hiddenInLegend: true,
    isFromAnnotation: true,
    ...(detailBaseMapId ? { detailBaseMapId } : {}),
  };
  template.code = getAnnotationTemplateCode({
    annotation: template,
    listingKey: listingId,
  });

  await db.annotationTemplates.add(template);
  return template;
}
