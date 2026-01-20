import polygonClipping from 'polygon-clipping';
import { nanoid } from "@reduxjs/toolkit";

// --- 1. UTILITAIRES (On garde les tiens) ---

const computeIntersection = (p1, v1, p2, v2) => {
    const cross = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(cross) < 1e-5) return null;

    const dp = { x: p2.x - p1.x, y: p2.y - p1.y };
    const t = (dp.x * v2.y - dp.y * v2.x) / cross;

    return { x: p1.x + t * v1.x, y: p1.y + t * v1.y };
};

/**
 * Calcule la polyligne décalée (Ligne "bis" parallèle).
 * Gère les extrémités différemment d'un polygone fermé.
 */
const getRawOffsetPolyline = (points, distance) => {
    const len = points.length;
    if (len < 2) return [];

    const lines = [];

    // 1. Calcul des vecteurs et des lignes décalées pour chaque segment
    for (let i = 0; i < len - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) continue;

        const ux = dx / length;
        const uy = dy / length;

        // Normale (Rotation 90°)
        const nx = -uy;
        const ny = ux;

        const pOffset = {
            x: p1.x + nx * distance,
            y: p1.y + ny * distance
        };

        lines.push({ p: pOffset, v: { x: ux, y: uy } });
    }

    if (lines.length === 0) return [];

    const offsetPoints = [];

    // 2. Traitement du PREMIER point (Start)
    // Pas d'intersection précédente, on prend le début de la première ligne décalée
    offsetPoints.push(lines[0].p);

    // 3. Traitement des points INTERMÉDIAIRES (Miter Joint)
    for (let i = 1; i < lines.length; i++) {
        const prevLine = lines[i - 1];
        const currLine = lines[i];

        const intersection = computeIntersection(prevLine.p, prevLine.v, currLine.p, currLine.v);

        // Si segments parallèles ou colinéaires, on prend le point de départ du segment actuel
        offsetPoints.push(intersection || currLine.p);
    }

    // 4. Traitement du DERNIER point (End)
    // On projette la fin du dernier segment décalé
    const lastLine = lines[lines.length - 1];
    // On doit avancer le long du vecteur directeur pour atteindre la fin du segment
    // Longueur du segment original correspondant
    const pLastOrgIndex = points.length - 2;
    const dx = points[pLastOrgIndex + 1].x - points[pLastOrgIndex].x;
    const dy = points[pLastOrgIndex + 1].y - points[pLastOrgIndex].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    offsetPoints.push({
        x: lastLine.p.x + lastLine.v.x * segLen,
        y: lastLine.p.y + lastLine.v.y * segLen
    });

    return offsetPoints;
};

// --- 2. FONCTION PRINCIPALE ---

/**
 * Crée un POLYGONE fermé à partir d'une POLYLIGNE et d'un offset.
 * Le polygone représente la surface entre la ligne A et la ligne B (offsetée).
 */
export default function offsetPolylineAsPolygon(points, distance) {
    if (!points || points.length < 2) return [];

    // 1. Calculer la ligne décalée (Offset Line)
    // Note: Pour une ligne ouverte, le "Sens" (CW/CCW) n'existe pas vraiment.
    // La distance positive décale à "Gauche" du tracé, négative à "Droite".
    const offsetPoints = getRawOffsetPolyline(points, distance);

    if (!offsetPoints || offsetPoints.length < 2) return [];

    // 2. Construire la boucle fermée
    // Ordre : [P0 -> Pn] (Original) puis [On -> O0] (Offset inversé)
    // Cela crée un "ruban" qui fait l'aller-retour.

    // On clone pour éviter de muter les entrées et on enlève les props inutiles
    const originalPath = points.map(p => ({ x: p.x, y: p.y }));
    const returnPath = [...offsetPoints].reverse();

    const closedLoop = [...originalPath, ...returnPath];

    // 3. Conversion GeoJSON pour la lib de clipping
    const geoJsonRing = closedLoop.map(p => [p.x, p.y]);

    // Fermeture explicite du GeoJSON (Premier point = Dernier point)
    const first = geoJsonRing[0];
    const last = geoJsonRing[geoJsonRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        geoJsonRing.push(first);
    }

    const inputMultiPoly = [[geoJsonRing]];

    try {
        // 4. Nettoyage (Union)
        // Polygon-clipping va gérer les cas où l'offset croise la ligne originale
        // (ex: boucle en forme de 8 ou offset très grand sur un angle aigu).
        const cleaned = polygonClipping.union(inputMultiPoly);

        if (cleaned.length > 0) {
            // Attention: Si l'offset coupe la ligne, cela peut créer PLUSIEURS polygones distincts.
            // Ici, on retourne souvent le plus grand ou on peut retourner un tableau de polygones.
            // Pour rester simple et cohérent avec ta demande (UN polygone), on prend le premier resultRing.
            // Idéalement, ta signature devrait supporter de renvoyer Multipolygon (Array<Array<Point>>).

            const resultRing = cleaned[0][0]; // Premier polygone, contour extérieur

            // Retrait du point de fermeture doublon
            resultRing.pop();

            return resultRing.map(p => ({
                id: nanoid(),
                x: p[0],
                y: p[1]
            }));
        }
    } catch (e) {
        console.error("Erreur offsetPolylineAsPolygon:", e);
        // Fallback : On retourne la boucle brute sans nettoyage
        return closedLoop.map(p => ({ ...p, id: nanoid() }));
    }

    return [];
}