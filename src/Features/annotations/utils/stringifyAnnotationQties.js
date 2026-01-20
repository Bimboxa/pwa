const unitMap = {
    UNIT: "u",
    METER: "ml",
    SQUARE_METER: "m²",
    CUBIC_METER: "m³",
};

export default function stringifyAnnotationQties(qties) {

    if (!qties.enabled) return "";

    // length

    const lengthS = `Linéaire: ${qties.length.toFixed(2)} ${unitMap.METER}`

    // surface

    const surfaceS = `Surface: ${qties.surface.toFixed(2)} ${unitMap.SQUARE_METER}`

    // label

    let label = lengthS;
    if (qties.surface) {
        label = `${lengthS} - ${surfaceS}`
    }
    else {
        label = lengthS;
    }

    // render

    return label;

}