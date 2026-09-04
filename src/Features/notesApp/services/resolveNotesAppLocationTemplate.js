import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import {
  FILL_FIELDS,
  STROKE_FIELDS,
} from "Features/form/utils/styleFieldGroups";

// Resolves the location annotationTemplate of a mapped "Ouvrages" listing:
// imported Krnet positions are drawn from one of the listing's OWN templates
// (the located-business-objects contract). Krnet defines none, so a listing
// without any gets a default template built from
// appConfig.features.notesApp.locationAnnotationTemplate (Label with leader
// stub). Pure preparation: the returned row (if any) is written by the
// orchestrator inside the merge transaction.
export default async function resolveNotesAppLocationTemplate({
  listing,
  projectId,
  appConfig,
  userIdMaster,
}) {
  const existing = (
    await db.annotationTemplates.where("listingId").equals(listing.id).toArray()
  ).filter((t) => !t.deletedAt);

  if (existing.length > 0) {
    // Same "first template" as the Localiser UI (orderIndex, then createdAt).
    const template = sortAnnotationTemplatesByOrder(existing)[0];
    return { template, templateRowToAdd: null };
  }

  const cfg = appConfig?.features?.notesApp?.locationAnnotationTemplate ?? {};
  const drawingShape = cfg.drawingShape ?? "LABEL";
  const nowIso = new Date().toISOString();

  const draft = {
    drawingShape,
    type: drawingShape, // LABEL/MARKER drawing shapes map 1:1 to their type
    label: cfg.label ?? "Étiquette",
    isFromAnnotation: true,
    ...getDefaultsForShape(drawingShape),
    ...(cfg.fillColor && { fillColor: cfg.fillColor }),
    ...(cfg.labelStubLength != null && {
      labelStubLength: cfg.labelStubLength,
    }),
    ...(cfg.labelStubMode && { labelStubMode: cfg.labelStubMode }),
    // Same locking defaults as the "Nouveau modèle" dialog: the template
    // imposes its colors on annotations.
    overrideFields: [...FILL_FIELDS, ...STROKE_FIELDS],
    isBusinessObjectAnnotation: true,
  };

  const template = {
    ...draft,
    id: nanoid(),
    projectId,
    listingId: listing.id,
    code: getAnnotationTemplateCode({
      annotation: draft,
      listingKey: listing.id,
    }),
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByUserIdMaster: userIdMaster,
  };

  return { template, templateRowToAdd: template };
}
