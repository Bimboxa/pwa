export default function getAnnotationTemplateFromNewAnnotationa({
    newAnnotation,
    annotationTemplates,
}) {

    if (!newAnnotation || !annotationTemplates?.length > 0) return null;

    switch (newAnnotation.type) {
        case "MARKER":
            return annotationTemplates.find(t =>
                t.type === "MARKER"
                && t.fillColor === newAnnotation.fillColor
            );
        case "POLYLINE":
            return annotationTemplates.find(t =>
                t.type === "POLYLINE"
                && t.strokeColor === newAnnotation.strokeColor
            );
        case "POLYGON":
            return annotationTemplates.find(t =>
                t.type === "POLYGON"
                && t.fillColor === newAnnotation.fillColor
            );
        default:
            return null;
    }

}