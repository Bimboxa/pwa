import getTopMiddlePoint from "Features/geometry/utils/getTopMiddlePoint";

export default function getAnnotationEditionPanelAnchor(annotation) {
    if (annotation?.points?.length > 1) {
        return getTopMiddlePoint(annotation.points);
    }

    // DISC: above the circle rather than on its centre.
    else if (
        annotation.type === "DISC" &&
        annotation.point &&
        Number.isFinite(annotation._planMeterByPx) &&
        annotation._planMeterByPx > 0 &&
        Number(annotation.radiusM) > 0
    ) {
        const r = Number(annotation.radiusM) / annotation._planMeterByPx;
        return { x: annotation.point.x, y: annotation.point.y - r }
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

    else if (
        annotation.bbox &&
        annotation.type === "OBJECT_3D"
    ) {
        return { x: annotation.bbox.x, y: annotation.bbox.y }
    }

    else {
        return null
    }
}