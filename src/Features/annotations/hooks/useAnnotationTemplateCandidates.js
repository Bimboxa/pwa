import useAnnotationTemplates from "./useAnnotationTemplates";

export default function useAnnotationTemplateCandidates(annotation, options) {

    const variant = options?.variant; // sameType
    const filterByListingId = options?.filterByListingId;

    const annotationTemplates = useAnnotationTemplates({ filterByListingId, sortByLabel: true });


    const currentTemplate = annotationTemplates?.find((t) => t.id === annotation?.annotationTemplateId);

    const typeCandidatesMap = {
        MARKER: ["MARKER"],
        POLYGON: ["POLYGON", "POLYLINE"],
        POLYLINE: ["POLYLINE", "POLYGON", "STRIP"],
        STRIP: ["STRIP", "POLYGON", "POLYLINE"],
        TEXT: ["TEXT"]
    }


    const candidates = annotationTemplates?.filter((t) => {
        if (variant === "sameType") {
            return currentTemplate?.type === t.type;
        }
        else {
            return typeCandidatesMap[currentTemplate?.type]?.includes(t.type)
        }

    });



    return candidates;
}