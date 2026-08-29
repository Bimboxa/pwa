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

/**
 * Offset (parallel) line for an OPEN polyline.
 * Returns the offset line points (miter joints), same count as the input.
 * Positive distance offsets to the "left" of the path (normale = (-uy, ux)),
 * negative to the "right". Each returned point gets a fresh id.
 */
export const offsetPolyline = (points, distance) => {
    const offsetPoints = getRawOffsetPolyline(points, distance);
    return offsetPoints.map((p) => ({ id: nanoid(), x: p.x, y: p.y }));
};

// --- 2. FONCTIONS PRINCIPALES ---

// Au-delà de ce ratio (longueur du miter / largeur), le coin de jonction est
// biseauté au lieu de mitré. Les coins carrés (√2 ≈ 1.41) et les plis à 45°
// (≈ 1.08) restent mitrés ; seules les jonctions très ouvertes (> ~106°)
// basculent en bevel — celles dont le miter file loin et dessine des pointes.
const MITER_RATIO_LIMIT = 2;

/**
 * Comme offsetPolylineAsPolygon, mais construit la bande comme l'UNION de
 * quads par segment + coins de jonction (miter plafonné, bevel au-delà), au
 * lieu du ruban aller-retour. Résultat identique sur une polyligne saine,
 * mais robuste quand un segment adjacent est plus court que la largeur
 * (jonctions issues de l'empilement des couches) : le ruban simple s'y
 * auto-croise et perd des lobes ou se troue.
 * Renvoie tous les anneaux extérieurs (bande scindée = plusieurs anneaux).
 * @returns {Array<Array<{id, x, y}>>}
 */
export function offsetPolylineAsPolygons(points, distance) {
    if (!points || points.length < 2) return [];

    // 1. Quads par segment (positif = gauche du tracé, normale (-uy, ux))
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) continue;
        const vx = dx / len;
        const vy = dy / len;
        segs.push({ a, b, vx, vy, ox: -vy * distance, oy: vx * distance });
    }
    if (!segs.length) return [];

    const inputs = segs.map(({ a, b, ox, oy }) => [[[
        [a.x, a.y],
        [b.x, b.y],
        [b.x + ox, b.y + oy],
        [a.x + ox, a.y + oy],
        [a.x, a.y],
    ]]]);

    // 2. Coins de jonction entre segments consécutifs
    const absDist = Math.abs(distance);
    for (let i = 1; i < segs.length; i++) {
        const p = segs[i - 1];
        const c = segs[i];
        const v = c.a; // sommet partagé (les segments nuls ont été sautés)
        const pEnd = { x: p.b.x + p.ox, y: p.b.y + p.oy };
        const cStart = { x: c.a.x + c.ox, y: c.a.y + c.oy };
        if (Math.hypot(pEnd.x - cStart.x, pEnd.y - cStart.y) < 1e-9) continue;
        const ring = [[v.x, v.y], [pEnd.x, pEnd.y]];
        const X = computeIntersection(
            { x: p.a.x + p.ox, y: p.a.y + p.oy },
            { x: p.vx, y: p.vy },
            cStart,
            { x: c.vx, y: c.vy }
        );
        if (X && Math.hypot(X.x - v.x, X.y - v.y) <= MITER_RATIO_LIMIT * absDist) {
            ring.push([X.x, X.y]);
        }
        ring.push([cStart.x, cStart.y]);
        ring.push([v.x, v.y]);
        inputs.push([[ring]]);
    }

    try {
        // 3. Union — les trous éventuels sont ignorés (comme avant)
        const cleaned = polygonClipping.union(...inputs);

        return cleaned.map((poly) => {
            const resultRing = poly[0]; // contour extérieur

            // Retrait du point de fermeture doublon
            resultRing.pop();

            return resultRing.map(p => ({
                id: nanoid(),
                x: p[0],
                y: p[1]
            }));
        });
    } catch (e) {
        console.error("Erreur offsetPolylineAsPolygons:", e);
        // Fallback : ruban brut aller-retour sans nettoyage
        const offsetPoints = getRawOffsetPolyline(points, distance);
        const closedLoop = [
            ...points.map(p => ({ x: p.x, y: p.y })),
            ...[...offsetPoints].reverse(),
        ];
        return [closedLoop.map(p => ({ ...p, id: nanoid() }))];
    }
}

/**
 * Crée un POLYGONE fermé à partir d'une POLYLIGNE et d'un offset.
 * Le polygone représente la surface entre la ligne A et la ligne B (offsetée).
 * Si le ruban se scinde en plusieurs lobes, seul le premier est renvoyé —
 * utiliser offsetPolylineAsPolygons quand tous comptent.
 */
export default function offsetPolylineAsPolygon(points, distance) {
    return offsetPolylineAsPolygons(points, distance)[0] ?? [];
}