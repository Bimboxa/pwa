export default function getTopMiddlePoint(points) {
    // Sécurité : si le tableau est vide ou nul
    if (!points || points.length === 0) {
        return null;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;

    // On parcourt tous les points pour trouver les extrêmes (Bounding Box)
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; // Y vers le bas => min Y est le plus haut
    }

    return {
        x: (minX + maxX) / 2, // Le milieu horizontal
        y: minY               // Le bord supérieur
    };
}