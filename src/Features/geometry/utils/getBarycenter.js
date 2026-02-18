export default function getBarycenter(points) {
    // Sécurité : si pas de points, on ne peut pas calculer de centre
    if (!points || points.length === 0) {
        return { x: 0, y: 0 }
    }

    let sumX = 0;
    let sumY = 0;

    // 1. On additionne toutes les coordonnées
    for (const p of points) {
        if (p) {
            sumX += p.x;
            sumY += p.y;
        }

    }

    // 2. On divise par le nombre de points pour obtenir la moyenne
    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
}