export default function getAnnotationLabelDeltaFromDeltaPos(annotation, deltaPos, partType) {

    const delta_target = annotation.labelDelta?.target ?? { x: 0, y: 0 };
    const delta_label = annotation.labelDelta?.label ?? { x: 0, y: 0 };


    let labelDelta = annotation.labelDelta ?? {};

    if (partType === "TARGET") {
        labelDelta = {
            ...annotation.labelDelta ?? {},
            target: {
                x: delta_target.x + deltaPos.x,
                y: delta_target.y + deltaPos.y
            }
        };
    } else if (partType === "LABEL_BOX") {
        labelDelta = {
            ...annotation.labelDelta ?? {},
            label: {
                x: delta_label.x + deltaPos.x,
                y: delta_label.y + deltaPos.y
            }
        };
    }

    return labelDelta;

}