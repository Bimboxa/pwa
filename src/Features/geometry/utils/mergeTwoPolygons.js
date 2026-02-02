import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from 'polygon-clipping';
import getGeoJsonFromPolygon from "./getGeoJsonFromPolygon";

export default function mergeTwoPolygons(polygonA, polygonB) {
    // 1. On utilise votre nouvel utilitaire qui gère déjà les cuts
    const { pointsFormatGeoJson: geoJsonA, pointByXY: pointByXY_A } = getGeoJsonFromPolygon(polygonA);
    const { pointsFormatGeoJson: geoJsonB, pointByXY: pointByXY_B } = getGeoJsonFromPolygon(polygonB);

    // 2. L'union calcule automatiquement les nouveaux contours et les trous créés
    const union = polygonClipping.union(geoJsonA, geoJsonB);

    // Si l'union donne plus d'un polygone, ils ne sont pas connectés
    if (union.length !== 1) {
        return null;
    }

    const resultPolygon = union[0]; // C'est un tableau de rings [[outer], [hole1], [hole2]...]
    const pointByXY_Combined = { ...pointByXY_A, ...pointByXY_B };
    const newPoints = [];

    // Fonction interne pour transformer un ring GeoJSON en vos objets {x, y, id}
    const mapRingToPoints = (ring) => {
        // En GeoJSON, le dernier point est le même que le premier. 
        // Pour votre format, on retire souvent le dernier pour éviter les doublons dans l'array.
        const pointsWithoutLast = ring.slice(0, -1);

        return pointsWithoutLast.map((point) => {
            const xS = point[0].toFixed(3);
            const yS = point[1].toFixed(3);
            const key = `${xS}_${yS}`;

            let existingPoint = pointByXY_Combined[key];
            if (!existingPoint) {
                existingPoint = { x: parseFloat(xS), y: parseFloat(yS), id: nanoid() };
                newPoints.push(existingPoint);
                // On l'ajoute au dictionnaire local pour ne pas créer 2 IDs si le même point 
                // apparaît dans deux anneaux différents (rare mais possible)
                pointByXY_Combined[key] = existingPoint;
            }
            return existingPoint;
        });
    };

    // 3. Le premier anneau est toujours l'extérieur
    const mergedMainPoints = mapRingToPoints(resultPolygon[0]);

    // 4. Les anneaux suivants sont les trous (cuts)
    const mergedCuts = resultPolygon.slice(1).map((holeRing) => {
        return {
            id: nanoid(),
            points: mapRingToPoints(holeRing)
        };
    });

    return {
        mergedPolygon: {
            points: mergedMainPoints,
            cuts: mergedCuts
        },
        newPoints
    };
}