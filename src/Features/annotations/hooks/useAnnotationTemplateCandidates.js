import { useSelector } from "react-redux";

import useAnnotationTemplates from "./useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

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

    const currentCategory = resolveShapeCategory(getTemplateShape(currentTemplate));
    const compatibleCategories = COMPATIBLE_SHAPE_CATEGORIES[currentCategory] ?? [];

    const candidates = annotationTemplates?.filter((t) => {
        if (variant === "sameType") {
            return getTemplateShape(currentTemplate) === getTemplateShape(t);
        }
        const candidateCategory = resolveShapeCategory(getTemplateShape(t));
        return compatibleCategories.includes(candidateCategory);
    });

    return { candidates, listings };
}
