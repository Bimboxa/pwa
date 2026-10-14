// Why the « Pinceau » armed in the 2D editor (template brush) refuses a
// clicked annotation — one place for the target rules
// (getTemplateBrushRefusal) and the French toaster labels
// (TEMPLATE_BRUSH_REFUSAL_LABELS). The brush converts the clicked annotation
// to the armed template, or duplicates it with that template (drawing helper
// switch « Dupliquer l'annotation cible »): both actions share the rules.
//
// Pure: node-testable, no imports (drawingShapeConfig pulls the MUI theme, so
// the few type / shape facts needed are listed here).

export const TEMPLATE_BRUSH_REFUSAL = Object.freeze({
  NO_TEMPLATE: "NO_TEMPLATE", // no armed template (template-less draft)
  READ_ONLY: "READ_ONLY", // read-only pseudo row (footprint, maille cell)
  SAME_TEMPLATE: "SAME_TEMPLATE", // the annotation already carries the template
  INCOMPATIBLE: "INCOMPATIBLE", // geometry the template cannot restyle
});

export const TEMPLATE_BRUSH_REFUSAL_LABELS = Object.freeze({
  NO_TEMPLATE: "Aucun modèle armé",
  READ_ONLY: "Annotation en lecture seule",
  SAME_TEMPLATE: "Cette annotation porte déjà ce modèle",
  INCOMPATIBLE: "Modèle incompatible avec cette annotation",
});

// Annotation types the template brush accepts: the `points` family the
// Surface / Ligne templates restyle without rebuilding the geometry (a
// STRIP stays a STRIP under a Ligne template, becomes a POLYGON under a
// Surface one — getAnnotationTypeOnTemplateChange / the clone hook). COTE,
// RULER, LINEAR_LAYOUT… share the family but would be re-typed to a 2-point
// polygon / line: refused. RECTANGLE is a bbox row (BBOX family): refused.
const ACCEPTED_TYPES = new Set(["POLYGON", "POLYLINE", "STRIP"]);

// Drawing shapes whose tool list offers the brush (drawingShapeConfig).
const BRUSH_TEMPLATE_SHAPES = new Set(["POLYGON", "POLYLINE"]);

/**
 * Refusal of a template-brush target.
 *
 * @param {object} args
 * @param {object} [args.annotation] - the clicked (resolved) annotation
 * @param {string} [args.annotationType] - its effective type
 *   (getEffectiveAnnotationType); defaults to annotation.type
 * @param {string|null} [args.templateId] - the armed template id
 * @param {string|null} [args.templateShape] - the armed template's resolved
 *   drawing shape ("POLYGON" / "POLYLINE")
 * @returns {string|null} a TEMPLATE_BRUSH_REFUSAL key, null when the click
 *   can convert / duplicate the annotation
 */
export default function getTemplateBrushRefusal({
  annotation,
  annotationType = annotation?.type,
  templateId = null,
  templateShape = null,
} = {}) {
  if (!templateId) return TEMPLATE_BRUSH_REFUSAL.NO_TEMPLATE;
  if (!annotation?.id) return TEMPLATE_BRUSH_REFUSAL.READ_ONLY;
  if (annotation.isForeignFootprint || annotation.isMeshCell) {
    return TEMPLATE_BRUSH_REFUSAL.READ_ONLY;
  }
  // Same template first: in duplicate mode a copy would be an undetectable
  // duplicate, in convert mode there is nothing to change.
  if (annotation.annotationTemplateId === templateId) {
    return TEMPLATE_BRUSH_REFUSAL.SAME_TEMPLATE;
  }
  if (!BRUSH_TEMPLATE_SHAPES.has(templateShape)) {
    return TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE;
  }
  if (!ACCEPTED_TYPES.has(annotationType)) {
    return TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE;
  }
  // isMesh3d: the 2D geometry is the plan projection of a stored mesh and
  // must stay a POLYGON (same rule as useAnnotationTemplateCandidates).
  if (annotation.isMesh3d && templateShape !== "POLYGON") {
    return TEMPLATE_BRUSH_REFUSAL.INCOMPATIBLE;
  }
  return null;
}

export function getTemplateBrushRefusalLabel(reason) {
  return TEMPLATE_BRUSH_REFUSAL_LABELS[reason] ?? "Annotation non convertible";
}
