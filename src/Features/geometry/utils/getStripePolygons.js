import offsetPolylineAsPolygon from "Features/geometry/utils/offsetPolylineAsPolygon";
import cutPolygonPoints from "Features/geometry/utils/cutPolygonPoints";

/**
 * Calcule la géométrie finale des polygones d'un Strip.
 * * @param {Object} annotation - L'objet annotation complet (points, cuts, props...)
 * @param {number} baseMapMeterByPx - Échelle de la carte
 * @param {boolean} [applyCutsMath=true] - Si true, calcule l'intersection réelle (modifie le contour ext). 
 * Si false, retourne le contour offset et les cuts bruts (pour l'édition).
 * @returns {Array<{points: Array, cuts: Array}>} Un tableau de formes (une par tronçon visible).
 */
export default function getStripePolygons(annotation, baseMapMeterByPx, applyCutsMath = true) {
    const {
        points = [],
        cuts = [],
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
        if (hiddenSegmentsIdx.includes(i)) {
            if (currentChunk.length > 1) chunks.push(currentChunk);
            currentChunk = [points[i + 1]];
        } else {
            currentChunk.push(points[i + 1]);
        }
    }
    if (currentChunk.length > 1) chunks.push(currentChunk);

    // 4. Génération des polygones pour chaque chunk
    const polygons = chunks.map((chunkPoints) => {
        // A. Calcul de la forme de base (Offset)
        const polyPoints = offsetPolylineAsPolygon(chunkPoints, distance);

        if (!polyPoints || polyPoints.length === 0) return null;

        // B. Gestion des Cuts
        if (applyCutsMath && cuts && cuts.length > 0) {
            // Mode "VUE" : On applique mathématiquement les découpes
            // Cela peut modifier 'points' (si cut à cheval) et remplir 'newCuts' (si cut intérieur)
            let polygonShape = { points: polyPoints, cuts: [] };

            cuts.forEach(cutDef => {
                if (cutDef.points && cutDef.points.length >= 3) {
                    polygonShape = cutPolygonPoints(polygonShape, cutDef.points);
                }
            });

            return polygonShape; // { points: modifiedExterior, cuts: interiorHoles }
        }
        else {
            // Mode "ÉDITION" ou pas de cuts : 
            // On retourne la forme offsetée pure et la liste des cuts originaux
            // (qui seront utilisés visuellement via fill-rule="evenodd" mais sans modifier la géométrie externe)
            return { points: polyPoints, cuts: cuts || [] };
        }

    }).filter(shape => shape && shape.points && shape.points.length >= 3);

    return polygons;
}