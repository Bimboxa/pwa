import { nanoid } from "@reduxjs/toolkit";

import {
  getDefaultsForShape,
  getToolsForShape,
} from "Features/annotations/constants/drawingShapeConfig";

// Build a plain annotationTemplate draft from an object-library manifest entry
// plus the user's dialog edits. Shaped like a normal annotationTemplate so it
// flows through startDrawFromTemplate / getNewAnnotationPropsFromAnnotationTemplate
// unchanged.
//
//   object    — a manifest entry ({ drawingShape, template, editableParams, ... })
//   userEdits — the dialog's edited values (only editableParams are kept)
//
// `defaultTool` is the figure's drawing tool (object.tool, e.g.
// POLYGON_CIRCLE_RADIUS); "Localiser" launches it via resolveActiveToolForTemplate.
export default function buildAnnotationTemplateFromObject(
  object,
  userEdits = {}
) {
  if (!object) return null;

  const drawingShape = object.drawingShape;
  const shapeDefaults = getDefaultsForShape(drawingShape);

  // Keep only whitelisted edits (defensive: the form is already filtered).
  const allowed = Array.isArray(object.editableParams)
    ? object.editableParams
    : [];
  const filteredEdits = {};
  for (const key of allowed) {
    if (userEdits[key] !== undefined && userEdits[key] !== null) {
      filteredEdits[key] = userEdits[key];
    }
  }

  const defaultTool = object.tool ?? getToolsForShape(drawingShape)[0] ?? null;

  return {
    id: nanoid(),
    // Library-model id: lets a listing detect it already holds a template for
    // this object (see the "modèle déjà présent" dialog on "Localiser").
    modelIdMaster: object.modelIdMaster ?? null,
    drawingShape,
    defaultTool,
    ...shapeDefaults,
    ...(object.template ?? {}),
    ...filteredEdits,
    label: filteredEdits.label ?? object.template?.label ?? object.label ?? "",
  };
}
