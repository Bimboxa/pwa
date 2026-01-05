import getBarycenter from "Features/geometry/utils/getBarycenter";

export default function getAnnotationLabelPropsFromAnnotation(annotation) {
    if (!annotation) return null;

    if (!["POLYGON", "POLYLINE"].includes(annotation?.type)) return null;

    const { label, points } = annotation;

    if (!points) return null;

    const barycenter = getBarycenter(points);

    const labelDelta = annotation.labelDelta || { target: { x: 0, y: 0 }, label: { x: 0, y: 0 } };

    const labelPoint = {
        x: barycenter.x + (labelDelta.label?.x || 0),
        y: barycenter.y + (labelDelta.label?.y || 0),
    };

    const targetPoint = {
        x: barycenter.x + (labelDelta.target?.x || 0),
        y: barycenter.y + (labelDelta.target?.y || 0),
    };


    return {
        id: "label::" + annotation.id,
        type: "LABEL",
        label,
        labelPoint,
        targetPoint,
        fillColor: annotation.fillColor,
        strokeColor: annotation.strokeColor,
        hidden: !annotation.showLabel,
    };
}