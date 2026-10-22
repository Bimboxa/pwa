import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
  getGeometryKindFromShape,
  getGeometryKindFromType,
} from "Features/annotations/constants/drawingShapeConfig";
import getEffectiveAnnotationType from "Features/annotations/utils/getEffectiveAnnotationType";

// Lines and surfaces share compatible geometry, so they are interchangeable.
// Points can only clone to other points.
const COMPATIBLE_SHAPE_CATEGORIES = {
  polyline: ["polyline", "rectangle"],
  rectangle: ["polyline", "rectangle"],
  circle: ["circle"],
};

function getTemplateShape(template) {
  return resolveDrawingShape(template);
}

// Reference shape of `annotation`: its current template's, unless that
// template's geometry family no longer matches the annotation's (the template
// was re-shaped after the annotation was drawn, e.g. a POLYGON template turned
// into a LABEL one): the annotation's own shape then drives the list, so the
// row can be re-templated to a compatible model.
function getReferenceShape(annotation, currentTemplate) {
  const annotationType = getEffectiveAnnotationType(annotation);
  const annotationKind = getGeometryKindFromType(annotationType);
  const templateShape = getTemplateShape(currentTemplate);
  const referenceShape =
    annotationKind && getGeometryKindFromShape(templateShape) !== annotationKind
      ? resolveDrawingShapeFromType(annotationType)
      : templateShape;
  return { annotationKind, referenceShape };
}

// True when `template` may be assigned to `annotation` (pure, no hooks).
// `currentTemplate` is the annotation's own template when known (the
// reference shape falls back to the annotation type without it).
export function isTemplateCompatibleWithAnnotation(
  annotation,
  template,
  { variant, currentTemplate = null } = {}
) {
  if (!annotation || !template) return false;
  const { annotationKind, referenceShape } = getReferenceShape(
    annotation,
    currentTemplate
  );
  const candidateShape = getTemplateShape(template);
  // A template is a style preset: it cannot rebuild the geometry, so a
  // candidate of another geometry family is never offered.
  if (
    annotationKind &&
    getGeometryKindFromShape(candidateShape) !== annotationKind
  ) {
    return false;
  }
  // isMesh3d: the 2D geometry is the plan projection of a stored mesh and
  // must stay a POLYGON — a line / strip model would re-type the row.
  if (annotation?.isMesh3d && getAnnotationType(candidateShape) !== "POLYGON") {
    return false;
  }
  if (variant === "sameType") {
    return referenceShape === candidateShape;
  }
  const currentCategory = resolveShapeCategory(referenceShape);
  const compatibleCategories =
    COMPATIBLE_SHAPE_CATEGORIES[currentCategory] ?? [];
  return compatibleCategories.includes(resolveShapeCategory(candidateShape));
}

// Templates of `annotationTemplates` compatible with `annotation` (pure).
export function getTemplateCandidatesForAnnotation(
  annotation,
  annotationTemplates,
  { variant } = {}
) {
  if (!annotation || !annotationTemplates) return [];
  const currentTemplate = annotationTemplates.find(
    (t) => t.id === annotation.annotationTemplateId
  );
  return annotationTemplates.filter((t) =>
    isTemplateCompatibleWithAnnotation(annotation, t, {
      variant,
      currentTemplate,
    })
  );
}

// `annotationOrAnnotations`: one annotation, or the whole selection. For a
// selection the candidates are the UNION of each annotation's candidates
// (a mixed RULER + COTE selection sees both families); the caller applies
// the chosen template to the compatible rows only
// (isTemplateCompatibleWithAnnotation).
export default function useAnnotationTemplateCandidates(
  annotationOrAnnotations,
  options
) {
  const variant = options?.variant; // sameType
  const filterByListingId = options?.filterByListingId;

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const annotationTemplates = useAnnotationTemplates({
    filterByListingId,
    sortByLabel: true,
  });

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  const candidates = useMemo(() => {
    if (!annotationTemplates) return annotationTemplates;
    const annotations = Array.isArray(annotationOrAnnotations)
      ? annotationOrAnnotations
      : [annotationOrAnnotations];
    const ids = new Set();
    for (const annotation of annotations) {
      for (const t of getTemplateCandidatesForAnnotation(
        annotation,
        annotationTemplates,
        { variant }
      )) {
        ids.add(t.id);
      }
    }
    // Keep the sortByLabel order of the source list.
    return annotationTemplates.filter((t) => ids.has(t.id));
  }, [annotationOrAnnotations, annotationTemplates, variant]);

  return { candidates, listings };
}
