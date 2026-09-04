import getBarycenter from "Features/geometry/utils/getBarycenter";

// Label drag → new labelDelta (image px relative to the barycenter).
// Shared by the 2D commit (MainMapEditorV3) and the 3D drag hook.
//
// labelDelta.elbow (VARIABLE stub mode) is the pinned leader elbow: it is kept
// on LABEL_BOX / TARGET drags (the chip moves, the elbow stays), counter-
// shifted with the label on a MARKER TARGET drag (the barycenter itself
// moves), and seeded from `options.elbowSeed` (absolute image px, published
// by NodeLabelStatic at drag start) on the first LABEL_BOX drag without a
// stored elbow.
export default function getAnnotationLabelDeltaFromDeltaPos(annotation, deltaPos, partType, options = {}) {

    const delta_target = annotation.labelDelta?.target ?? { x: 0, y: 0 };
    const delta_label = annotation.labelDelta?.label ?? { x: 0, y: 0 };
    const delta_elbow = annotation.labelDelta?.elbow ?? null;


    let labelDelta = annotation.labelDelta ?? {};

    if (partType === "TARGET") {
        let newLabel = annotation.labelDelta?.label ?? { x: 0, y: 0 };
        let newElbow = delta_elbow;
        let newTarget = {
            x: delta_target.x + deltaPos.x,
            y: delta_target.y + deltaPos.y
        }
        if (annotation.type === "MARKER") {
            newLabel = {
                x: delta_label.x - deltaPos.x,
                y: delta_label.y - deltaPos.y
            }
            if (delta_elbow) {
                newElbow = {
                    x: delta_elbow.x - deltaPos.x,
                    y: delta_elbow.y - deltaPos.y
                }
            }
            newTarget = {
                x: 0,
                y: 0,
            }
        }
        labelDelta = {
            ...annotation.labelDelta ?? {},
            label: newLabel,
            target: newTarget,
        };
        if (newElbow) labelDelta.elbow = newElbow;
        else delete labelDelta.elbow;
    } else if (partType === "LABEL_BOX") {
        labelDelta = {
            ...annotation.labelDelta ?? {},
            label: {
                x: delta_label.x + deltaPos.x,
                y: delta_label.y + deltaPos.y
            }
        };
        const seed = options?.elbowSeed;
        if (!delta_elbow && seed && Number.isFinite(seed.x) && Number.isFinite(seed.y)) {
            const points = ["POINT", "MARKER"].includes(annotation.type)
                ? [annotation.point]
                : annotation.points;
            const barycenter = points?.length ? getBarycenter(points) : null;
            if (barycenter && Number.isFinite(barycenter.x) && Number.isFinite(barycenter.y)) {
                labelDelta.elbow = {
                    x: seed.x - barycenter.x,
                    y: seed.y - barycenter.y,
                };
            }
        }
    }

    return labelDelta;

}
