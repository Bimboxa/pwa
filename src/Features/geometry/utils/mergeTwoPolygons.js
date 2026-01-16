import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from 'polygon-clipping';
import closePolygonPoints from "./closePolygonPoints";
import getGeoJsonFromPoints from "./getGeoJsonFromPoints";

export default function mergeTwoPolygons(pointsA, pointsB) {

    const { pointsFormatGeoJson: geoJsonA, pointByXY: pointByXY_A } = getGeoJsonFromPoints(closePolygonPoints(pointsA));
    const { pointsFormatGeoJson: geoJsonB, pointByXY: pointByXY_B } = getGeoJsonFromPoints(closePolygonPoints(pointsB));

    // L'union retourne un MultiPolygon (Array of Polygons)
    const union = polygonClipping.union(geoJsonA, geoJsonB);

    // VÉRIFICATION CRITIQUE :
    // Si length > 1, c'est que les polygones ne se touchent pas (ils sont restés séparés).
    // On renvoie null pour dire "Fusion impossible pour l'instant".
    if (union.length !== 1) {
        return null;
    }

    const mergedPolygon = [];
    const newPoints = [];

    // Puisque union.length === 1, on peut prendre [0] en toute sécurité
    // Attention: union[0] est un Polygon, qui contient des rings. 
    // union[0][0] est l'anneau extérieur (celui qu'on veut généralement).
    const mainRing = union[0][0];

    mainRing.forEach((point) => {
        const xS = point[0].toFixed(3);
        const yS = point[1].toFixed(3);
        const key = `${xS}_${yS}`;

        // Ta logique de conservation d'ID
        let newPoint = pointByXY_A[key] || pointByXY_B[key];
        if (!newPoint) {
            newPoint = { x: parseFloat(xS), y: parseFloat(yS), id: nanoid() };
            newPoints.push(newPoint);
        }
        mergedPolygon.push(newPoint);
    });

    return { mergedPolygon, newPoints };

}