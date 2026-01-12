import getTopMiddlePoint from "Features/geometry/utils/getTopMiddlePoint";

export default function getAnnotationEditionPanelAnchor(annotation) {
    if (annotation?.points?.length > 1) {
        return getTopMiddlePoint(annotation.points);
    }

    else if (annotation.point) {
        return { x: annotation.point.x, y: annotation.point.y - 50 }
    }

    else if (annotation.bbox) {
        return { x: annotation.bbox.x, y: annotation.bbox.y - 50 }
    }
    else {
        return null
    }
}