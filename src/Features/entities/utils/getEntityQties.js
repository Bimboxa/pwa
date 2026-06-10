export default function getEntityQties(entity, options) {

    // options

    const formatAsOneLiner = options?.formatAsOneLiner;

    // qties

    let qties = {}

    // edge case

    const { annotations } = entity;

    if (!annotations || annotations.length === 0) {

        // return qties

    } else {
        qties = annotations.reduce((acc, annotation) => {
            // Skip mesh cells: the parent annotation already carries the
            // quantity, so counting its cells too would double-count.
            if (annotation?.isMeshCell) return acc;

            const { length, surface } = annotation?.qties ?? {}

            // length
            if (length) {
                if (acc.length) {
                    acc.length += length;
                } else {
                    acc.length = length;
                }
            }

            // surface
            if (surface) {
                if (acc.surface) {
                    acc.surface += surface;
                } else {
                    acc.surface = surface;
                }
            }

            return acc;
        }, {})
    }

    // return qties

    // return qties

    if (formatAsOneLiner) {
        let parts = [];
        if (qties.length) parts.push(`L=${qties.length.toFixed(2)} m`);
        if (qties.surface) parts.push(`S = ${qties.surface.toFixed(1)} m²`);
        return parts.join(", ");
    } else {
        return qties;
    }
}