import offsetPolylineAsPolygon from "Features/geometry/utils/offsetPolylineAsPolygon";

/**
 * Calcule la géométrie des polygones (Strips) d'une annotation.
 * Gère les unités (PX/CM), l'orientation et les segments cachés.
 * * @param {Object} annotation - L'objet annotation complet
 * @param {number} baseMapMeterByPx - L'échelle de la carte (mètres par pixel)
 * @returns {Array<Array<{x: number, y: number}>>} Un tableau de tableaux de points (un tableau par chunk visible).
 */
export default function getPolygonsPointsFromStripAnnotation(annotation, baseMapMeterByPx) {
    const {
        points = [],
        strokeWidth = 20,
        strokeWidthUnit = "PX",
        hiddenSegmentsIdx = [],
        stripOrientation = 1,
    } = annotation || {};

    // 1. Validation de base
    if (!points || points.length < 2) return [];

    // 2. Calcul de la distance d'offset (Largeur du strip)
    const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;

    let distance;
    if (isCmUnit) {
        // Conversion CM -> Mètres -> Pixels, puis application de l'orientation
        distance = (strokeWidth * 0.01) / baseMapMeterByPx * stripOrientation;
    } else {
        // Pixels bruts
        distance = strokeWidth * stripOrientation;
    }

    // 3. Découpage en tronçons (Chunks) selon les segments cachés
    const chunks = [];
    let currentChunk = [points[0]];

    for (let i = 0; i < points.length - 1; i++) {
        // Si le segment actuel est caché, on termine le chunk courant et on en commence un nouveau
        if (hiddenSegmentsIdx.includes(i)) {
            if (currentChunk.length > 1) chunks.push(currentChunk);
            currentChunk = [points[i + 1]];
        } else {
            currentChunk.push(points[i + 1]);
        }
    }
    // Ajouter le dernier chunk s'il est valide
    if (currentChunk.length > 1) chunks.push(currentChunk);

    // 4. Génération des polygones pour chaque chunk
    const polygons = chunks.map((chunkPoints) => {
        return offsetPolylineAsPolygon(chunkPoints, distance);
    }).filter(poly => poly && poly.length > 0);

    return polygons;
}