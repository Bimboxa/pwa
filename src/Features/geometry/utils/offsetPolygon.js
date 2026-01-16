import polygonClipping from 'polygon-clipping';
import { nanoid } from "@reduxjs/toolkit";

// --- 1. UTILITAIRES GÉOMÉTRIQUES ---

/**
 * Calcule l'aire signée du polygone (Shoelace Formula).
 * Permet de déterminer le sens du tracé (Horaire vs Anti-Horaire).
 */
const getSignedArea = (points) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        // Formule standard : (x2 - x1) * (y2 + y1)
        area += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return area / 2;
};

// Calcule l'intersection de deux lignes définies par point + vecteur
const computeIntersection = (p1, v1, p2, v2) => {
    const cross = v1.x * v2.y - v1.y * v2.x;
    if (Math.abs(cross) < 1e-5) return null; // Parallèle

    const dp = { x: p2.x - p1.x, y: p2.y - p1.y };
    const t = (dp.x * v2.y - dp.y * v2.x) / cross;

    return { x: p1.x + t * v1.x, y: p1.y + t * v1.y };
};

/**
 * Génère un polygone "brut" décalé.
 */
const getRawOffsetPolygon = (points, distance) => {
    const len = points.length;
    if (len < 3) return points;

    const lines = [];

    for (let i = 0; i < len; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % len];

        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) continue;

        const ux = dx / length;
        const uy = dy / length;

        // --- EXPLICATION DU SENS ---
        // nx = -uy, ny = ux correspond à une rotation de +90° (Tourne à GAUCHE).
        // - Si le polygone est HORAIRE (CW), "Gauche" = EXTÉRIEUR (Agrandissement).
        // - Si le polygone est ANTI-HORAIRE (CCW), "Gauche" = INTÉRIEUR (Rétrécissement).
        const nx = -uy;
        const ny = ux;

        const pOffset = {
            x: p1.x + nx * distance,
            y: p1.y + ny * distance
        };

        lines.push({ p: pOffset, v: { x: ux, y: uy } });
    }

    // Recalcul des intersections
    const newPoints = [];
    for (let i = 0; i < lines.length; i++) {
        const prevLine = lines[(i - 1 + lines.length) % lines.length];
        const currLine = lines[i];

        const intersection = computeIntersection(prevLine.p, prevLine.v, currLine.p, currLine.v);
        newPoints.push(intersection || currLine.p);
    }

    return newPoints;
};

// --- 2. FONCTION PRINCIPALE ---

export default function offsetPolygon(points, distance) {
    if (!points || points.length < 3) return [];

    // --- A. DÉTECTION ET CORRECTION DU SENS ---
    // Dans un repère écran (Y vers le bas) :
    // - Area > 0  => Sens Horaire (Clockwise)
    // - Area < 0  => Sens Anti-Horaire (Counter-Clockwise)
    const area = getSignedArea(points);
    const isClockwise = area > 0;

    // Notre mathématique (nx = -uy) sort "à gauche".
    // "Gauche" est l'extérieur seulement si on tourne en sens Horaire.
    // Si on est en Anti-Horaire, "Gauche" est l'intérieur, donc on inverse la distance pour aller à "Droite".
    let effectiveDistance = distance;
    if (!isClockwise) {
        effectiveDistance = -distance;
    }

    // 1. Calcul mathématique avec la distance corrigée
    const rawPoints = getRawOffsetPolygon(points, effectiveDistance);

    if (!rawPoints || rawPoints.length < 3) return [];

    // 2. Préparation GeoJSON (Fermeture de boucle)
    const geoJsonRing = rawPoints.map(p => [p.x, p.y]);
    const first = geoJsonRing[0];
    const last = geoJsonRing[geoJsonRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        geoJsonRing.push(first);
    }

    const inputMultiPoly = [[geoJsonRing]];

    try {
        // 3. Nettoyage avec Polygon-Clipping (Union sur soi-même)
        const cleaned = polygonClipping.union(inputMultiPoly);

        if (cleaned.length > 0) {
            // On récupère le contour extérieur du premier polygone résultant
            const resultRing = cleaned[0][0];

            // On retire le point de fermeture doublon
            resultRing.pop();

            return resultRing.map(p => ({
                id: nanoid(),
                x: p[0],
                y: p[1]
            }));
        }
    } catch (e) {
        console.error("Erreur offsetPolygon:", e);
        // En cas d'échec critique, on rend les points calculés manuellement
        // (Mieux vaut une forme imparfaite que rien du tout)
        return rawPoints.map(p => ({ ...p, id: nanoid() }));
    }

    return [];
}