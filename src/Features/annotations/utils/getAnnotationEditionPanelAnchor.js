import getTopMiddlePoint from "Features/geometry/utils/getTopMiddlePoint";

export default function getAnnotationEditionPanelAnchor(annotation) {
    if (annotation?.points?.length > 1) {
        return getTopMiddlePoint(annotation.points);
    }

    else if (annotation.point) {
        return { x: annotation.point.x, y: annotation.point.y }
    }

    else if (annotation.bbox && annotation.type === "RECTANGLE") {
        return { x: annotation.bbox.x + annotation.bbox.width, y: annotation.bbox.y }
    }

    else if (annotation.bbox && annotation.type === "IMAGE") {
        return { x: annotation.bbox.x, y: annotation.bbox.y }
    }

    else {
        return null
    }
}