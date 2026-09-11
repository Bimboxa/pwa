import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import {
  getAnnotationType,
  getDefaultsForShape,
  resolveDrawingShape,
} from "Features/annotations/constants/drawingShapeConfig";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";
import {
  FILL_FIELDS,
  STROKE_FIELDS,
} from "Features/form/utils/styleFieldGroups";

const SHAPE_LABELS = { POLYLINE: "Ligne", POLYGON: "Surface" };

// Resolves the annotationTemplates of a mapped "Ouvrages" listing, one per
// drawing shape: imported Krnet positions (LABEL) and shapes (POLYLINE /
// POLYGON) are drawn from the listing's OWN templates (the located-business-
// objects contract). For each requested shape the listing's first template of
// that shape is reused (orderIndex, then createdAt — same "first template"
// as the Localiser UI), else one is built: the LABEL from
// appConfig.features.notesApp.locationAnnotationTemplate (Label with leader
// stub), the shapes from the drawing-shape defaults colored with the Krnet
// list color. Pure preparation: the returned rows are written by the
// orchestrator inside the merge transaction.
export default async function resolveNotesAppTemplates({
  listing,
  remoteListing,
  shapes = ["LABEL"],
  projectId,
  appConfig,
  userIdMaster,
}) {
  const existing = (
    await db.annotationTemplates.where("listingId").equals(listing.id).toArray()
  ).filter((t) => !t.deletedAt);

  const templatesByShape = {};
  const templateRowsToAdd = [];
  const nowIso = new Date().toISOString();
  const listColor = remoteListing?.color ?? listing?.color ?? null;

  for (const shape of shapes) {
    const ofShape = existing.filter((t) => resolveDrawingShape(t) === shape);
    if (ofShape.length > 0) {
      templatesByShape[shape] = sortAnnotationTemplatesByOrder(ofShape)[0];
      continue;
    }

    let draft;
    if (shape === "LABEL") {
      const cfg =
        appConfig?.features?.notesApp?.locationAnnotationTemplate ?? {};
      const drawingShape = cfg.drawingShape ?? "LABEL";
      draft = {
        drawingShape,
        type: getAnnotationType(drawingShape) ?? drawingShape,
        label: cfg.label ?? "Étiquette",
        ...getDefaultsForShape(drawingShape),
        ...(cfg.fillColor && { fillColor: cfg.fillColor }),
        ...(cfg.labelStubLength != null && {
          labelStubLength: cfg.labelStubLength,
        }),
        ...(cfg.labelStubMode && { labelStubMode: cfg.labelStubMode }),
      };
    } else {
      // POLYGON strokes render in fillColor (NodePolylineStatic); a
      // POLYLINE only has a stroke.
      const colorKey = shape === "POLYGON" ? "fillColor" : "strokeColor";
      draft = {
        drawingShape: shape,
        type: getAnnotationType(shape) ?? shape,
        label: SHAPE_LABELS[shape] ?? shape,
        ...getDefaultsForShape(shape),
        ...(listColor && { [colorKey]: listColor }),
        ...(shape === "POLYGON" && listColor && { strokeColor: listColor }),
      };
    }
    draft = {
      ...draft,
      isFromAnnotation: true,
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
    templatesByShape[shape] = template;
    templateRowsToAdd.push(template);
  }

  return { templatesByShape, templateRowsToAdd };
}
