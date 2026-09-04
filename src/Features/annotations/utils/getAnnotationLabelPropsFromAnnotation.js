import getBarycenter from "Features/geometry/utils/getBarycenter";
import {
    ANNOTATION_LABEL_FONT_SIZES_PX,
    getAnnotationLabelTextLines,
    getAnnotationOwnLabel,
} from "./getAnnotationLabelDisplay";
import getAnnotationLabelStubConfig from "./getAnnotationLabelStubConfig";

export default function getAnnotationLabelPropsFromAnnotation(annotation) {
    if (!annotation) return null;

    // The chip shows (and edits) the annotation's OWN label — never the entity
    // or template one.
    const label = getAnnotationOwnLabel(annotation);
    let { points, point } = annotation;
    if (["POINT", "MARKER"].includes(annotation.type)) points = [point];

    if (!points) return null;

    const barycenter = getBarycenter(points);

    // Label color = the annotation's VISIBLE color: line types are drawn with
    // strokeColor (same rule as NodePolylineStatic), surface types with
    // fillColor.
    const isLineType = ["POLYLINE", "STRIP", "LINEAR_LAYOUT"].includes(annotation.type);
    const visibleColor = isLineType
        ? annotation.strokeColor || annotation.fillColor
        : annotation.fillColor || annotation.strokeColor;

    const labelDelta = annotation.labelDelta || { target: { x: 0, y: 0 }, label: { x: 0, y: 0 } };

    const labelPoint = {
        x: barycenter.x + (labelDelta.label?.x || 0),
        y: barycenter.y + (labelDelta.label?.y || 0),
    };

    const targetPoint = {
        x: barycenter.x + (labelDelta.target?.x || 0),
        y: barycenter.y + (labelDelta.target?.y || 0),
    };

    // Leader stub ("déport horizontal"): resolved config + the pinned elbow
    // (VARIABLE mode) in absolute image px, like labelPoint / targetPoint.
    const stub = getAnnotationLabelStubConfig(annotation);
    const elbowPoint = labelDelta.elbow
        ? {
            x: barycenter.x + (labelDelta.elbow.x || 0),
            y: barycenter.y + (labelDelta.elbow.y || 0),
        }
        : null;


    return {
        id: "label::" + annotation.id,
        type: "LABEL",
        label,
        lines: getAnnotationLabelTextLines(annotation),
        fontSize:
            ANNOTATION_LABEL_FONT_SIZES_PX[annotation.labelFontSize] ??
            ANNOTATION_LABEL_FONT_SIZES_PX.M,
        labelPoint,
        targetPoint,
        labelStubLength: stub.length,
        labelStubMode: stub.mode,
        elbowPoint,
        // Needed by the elbow handle (NodeLabelStatic) to persist the elbow
        // relative to the barycenter without re-reading the row.
        barycenter,
        labelDelta,
        // Chip width in screen px (resize handle in NodeLabelStatic);
        // undefined = auto (content-driven).
        width: annotation.labelWidth,
        // Drop shadow on the 2D chip ("Ombre" switch, default off).
        shadow: annotation.labelShadow === true,
        fillColor: visibleColor,
        strokeColor: annotation.strokeColor,
        hidden: !annotation.showLabel,
        // Main annotation of a located business object: the chip shows the
        // object's label, and editing it renames the object.
        mainBusinessObjectId: annotation.mainBusinessObjectId ?? null,
    };
}