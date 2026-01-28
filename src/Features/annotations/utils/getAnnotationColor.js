export default function getAnnotationColor(annotation) {

    if (!annotation) return null;

    if (["MARKER", "POLYGON", "STRIP"].includes(annotation.type)) {
        return annotation.fillColor;
    }

    else if (["POLYLINE"].includes(annotation.type)) {
        return annotation.strokeColor;
    }

    else {
        return annotation.color;
    }
}