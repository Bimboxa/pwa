import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";
import offsetPolylineAsPolygon from "Features/geometry/utils/offsetPolylineAsPolygon";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
import cutPolygonPoints from "Features/geometry/utils/cutPolygonPoints";

// Build annular polygon (donut) from a closed strip.
// Returns array of {points, cuts} like the open-strip path.
function getClosedStripPolygon(points, distance, cuts, applyCutsMath) {
    const offsetRing = offsetPolygon(points, distance);
    if (!offsetRing || offsetRing.length < 3) return null;

    // Convert to GeoJSON rings (closed)
    const toGeoRing = (pts) => {
        const ring = pts.map((p) => [p.x, p.y]);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
        return ring;
    };

    const originalRing = toGeoRing(points);
    const offsetGeoRing = toGeoRing(offsetRing);

    // Use polygon-clipping.difference to get the band between the two rings
    try {
        const outer = [[offsetGeoRing]];
        const inner = [[originalRing]];
        const band = polygonClipping.xor(outer, inner);

        if (band.length > 0) {
            // Take the first result polygon — outer boundary + holes
            const resultPoly = band[0];
            const outerBoundary = resultPoly[0];
            // Remove closing point duplicate
            const outerPoints = outerBoundary
                .slice(0, -1)
                .map((p) => ({ id: nanoid(), x: p[0], y: p[1] }));

            const holeCuts = resultPoly.slice(1).map((hole) => ({
                points: hole
                    .slice(0, -1)
                    .map((p) => ({ id: nanoid(), x: p[0], y: p[1] })),
            }));

            let polygonShape = { points: outerPoints, cuts: holeCuts };

            // Apply annotation cuts if needed
            if (applyCutsMath && cuts && cuts.length > 0) {
                cuts.forEach((cutDef) => {
                    if (cutDef.points && cutDef.points.length >= 3) {
                        polygonShape = cutPolygonPoints(polygonShape, cutDef.points);
                    }
                });
            }

            return polygonShape;
        }
    } catch (e) {
        console.error("Erreur getClosedStripPolygon:", e);
    }

    return null;
}

/**
 * Calcule la géométrie finale des polygones d'un Strip.
 * @param {Object} annotation - L'objet annotation complet (points, cuts, props...)
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
        closeLine = false,
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

    // 3. Detect implicit closure (last point equals first point)
    let effectiveCloseLine = closeLine;
    let effectivePoints = points;
    if (!effectiveCloseLine && points.length >= 4) {
        const first = points[0];
        const last = points[points.length - 1];
        if (first.x === last.x && first.y === last.y) {
            effectiveCloseLine = true;
            effectivePoints = points.slice(0, -1);
        }
    }

    // 4. Closed strip: compute annular band directly
    if (effectiveCloseLine && effectivePoints.length >= 3) {
        const result = getClosedStripPolygon(effectivePoints, distance, cuts, applyCutsMath);
        return result ? [result] : [];
    }

    // 5. Découpage en tronçons (Chunks) selon les segments cachés
    const chunks = [];
    let currentChunk = [effectivePoints[0]];

    for (let i = 0; i < effectivePoints.length - 1; i++) {
        if (hiddenSegmentsIdx.includes(i)) {
            if (currentChunk.length > 1) chunks.push(currentChunk);
            currentChunk = [effectivePoints[i + 1]];
        } else {
            currentChunk.push(effectivePoints[i + 1]);
        }
    }
    if (currentChunk.length > 1) chunks.push(currentChunk);

    // 5. Génération des polygones pour chaque chunk
    const polygons = chunks.map((chunkPoints) => {
        // A. Calcul de la forme de base (Offset)
        const polyPoints = offsetPolylineAsPolygon(chunkPoints, distance);

        if (!polyPoints || polyPoints.length === 0) return null;

        // B. Gestion des Cuts
        if (applyCutsMath && cuts && cuts.length > 0) {
            // Mode "VUE" : On applique mathématiquement les découpes
            let polygonShape = { points: polyPoints, cuts: [] };

            cuts.forEach(cutDef => {
                if (cutDef.points && cutDef.points.length >= 3) {
                    polygonShape = cutPolygonPoints(polygonShape, cutDef.points);
                }
            });

            return polygonShape;
        }
        else {
            // Mode "ÉDITION" ou pas de cuts
            return { points: polyPoints, cuts: cuts || [] };
        }

    }).filter(shape => shape && shape.points && shape.points.length >= 3);

    return polygons;
}
