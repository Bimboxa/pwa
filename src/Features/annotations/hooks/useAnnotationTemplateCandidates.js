import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import {
    resolveDrawingShape,
    resolveDrawingShapeFromType,
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

export default function useAnnotationTemplateCandidates(annotation, options) {

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
        excludeIsForBaseMaps: true,
    });

    const currentTemplate = annotationTemplates?.find((t) => t.id === annotation?.annotationTemplateId);

    // Reference shape: the current template's, unless its geometry family no
    // longer matches the annotation's (the template was re-shaped after the
    // annotation was drawn, e.g. a POLYGON template turned into a LABEL one):
    // the annotation's own shape then drives the list, so the row can be
    // re-templated to a compatible model.
    const annotationType = getEffectiveAnnotationType(annotation);
    const annotationKind = getGeometryKindFromType(annotationType);
    const templateShape = getTemplateShape(currentTemplate);
    const referenceShape =
        annotationKind && getGeometryKindFromShape(templateShape) !== annotationKind
            ? resolveDrawingShapeFromType(annotationType)
            : templateShape;

    const currentCategory = resolveShapeCategory(referenceShape);
    const compatibleCategories = COMPATIBLE_SHAPE_CATEGORIES[currentCategory] ?? [];

    const candidates = annotationTemplates?.filter((t) => {
        const candidateShape = getTemplateShape(t);
        // A template is a style preset: it cannot rebuild the geometry, so a
        // candidate of another geometry family is never offered.
        if (annotationKind && getGeometryKindFromShape(candidateShape) !== annotationKind) {
            return false;
        }
        if (variant === "sameType") {
            return referenceShape === candidateShape;
        }
        const candidateCategory = resolveShapeCategory(candidateShape);
        return compatibleCategories.includes(candidateCategory);
    });

    return { candidates, listings };
}
