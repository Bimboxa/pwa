import getTopMiddlePoint from "Features/geometry/utils/getTopMiddlePoint";

export default function getAnnotationEditionPanelAnchor(annotation) {
    if (annotation?.points?.length > 1) {
        return getTopMiddlePoint(annotation.points);
    }

    else {
        return null
    }
}