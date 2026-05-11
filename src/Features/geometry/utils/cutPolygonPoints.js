import polygonClipping from 'polygon-clipping';
import { nanoid } from '@reduxjs/toolkit'; // Ou ta méthode de génération d'ID habituelle

/**
 * Transforme un tableau de points {x,y} en tableau de coordonnées [x,y]
 * et ferme la boucle si nécessaire (pour polygon-clipping).
 */
const toRing = (points) => {
    if (!points || points.length === 0) return [];
    const ring = points.map(p => [p.x, p.y]);

    // Fermeture du ring si ouvert (nécessaire pour polygon-clipping)
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
    }
    return ring;
};

/**
 * Signed area of a closed polygon-clipping ring (shoelace).
 * Sign reflects orientation; magnitude is the polygon area in pixel² units.
 */
const ringSignedArea = (ring) => {
    let s = 0;
    for (let i = 0, n = ring.length - 1; i < n; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        s += x1 * y2 - x2 * y1;
    }
    return s / 2;
};

/**
 * Transforme un ring [x,y] (de polygon-clipping) vers le format {id,x,y}.
 * Retire le point de fermeture doublon.
 */
const fromRing = (ring) => {
    // On retire le dernier point car il est identique au premier dans GeoJSON
    const openRing = ring.slice(0, ring.length - 1);
    return openRing.map(p => ({
        id: nanoid(), // Nouveaux IDs car la géométrie a changé (nouveaux vertex créés)
        x: p[0],
        y: p[1]
    }));
};

export default function cutPolygonPoints(polygon, cutPoints, options = {}) {
    const { points: mainPoints, cuts: existingCuts } = polygon ?? {};
    const splitMode = options.splitMode ?? "keepLargest";

    // 1. Sécurité
    if (!mainPoints || mainPoints.length < 3 || !cutPoints || cutPoints.length < 3) {
        return { points: mainPoints ?? [], cuts: existingCuts ?? [] };
    }

    // 2. Préparation du "Subject" (Le polygone actuel avec ses trous existants)
    // Structure GeoJSON : [[ExteriorRing], [Hole1], [Hole2]...]
    const subjectGeom = [
        toRing(mainPoints),
        ...(existingCuts || []).map(cut => toRing(cut.points))
    ];

    // 3. Préparation du "Clipper" (Le nouveau trou)
    const clipperGeom = [
        toRing(cutPoints)
    ];

    try {
        // 4. Opération booléenne : Différence (Sujet - Trou)
        const result = polygonClipping.difference([subjectGeom], [clipperGeom]);

        // 5. Analyse du résultat
        if (result.length === 0) {
            // Le trou a tout mangé -> plus de polygone
            return { points: [], cuts: [] };
        }

        // Le résultat est un MultiPolygon (Array de Polygones).
        // Si le cut coupe le polygone en plusieurs morceaux distincts, result.length sera > 1.
        if (result.length > 1 && splitMode === "abort") {
            return { points: mainPoints, cuts: existingCuts ?? [], aborted: true };
        }

        // splitMode === "keepLargest": pick the polygon with the largest exterior ring area.
        let chosenIdx = 0;
        if (result.length > 1) {
            let bestArea = -Infinity;
            for (let i = 0; i < result.length; i++) {
                const ring = result[i][0];
                const a = Math.abs(ringSignedArea(ring));
                if (a > bestArea) {
                    bestArea = a;
                    chosenIdx = i;
                }
            }
        }
        const newPolygonDef = result[chosenIdx]; // [Exterior, Hole1, Hole2...]

        // L'anneau 0 est TOUJOURS l'extérieur (modifié ou non)
        const newExteriorPoints = fromRing(newPolygonDef[0]);

        // Les anneaux suivants sont les trous (anciens + nouveau si cas "intérieur")
        const newCutsRings = newPolygonDef.slice(1);

        const newCuts = newCutsRings.map((ring, index) => {
            // On essaie de préserver les IDs des cuts existants si possible, sinon on recrée
            // Note: C'est complexe de mapper les anciens cuts aux nouveaux géométriquement, 
            // ici on recrée proprement les objets cuts.
            return {
                id: nanoid(), // Ou logique de réconciliation si besoin
                label: `Cut ${index + 1}`,
                points: fromRing(ring)
            };
        });

        return {
            points: newExteriorPoints,
            cuts: newCuts
        };

    } catch (error) {
        console.error("Erreur lors du cutPolygon:", error);
        // Fallback : on ne fait rien
        return { points: mainPoints, cuts: existingCuts };
    }
}