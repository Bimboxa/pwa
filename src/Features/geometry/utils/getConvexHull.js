/**
 * Calcule le produit vectoriel (Cross Product) de 3 points (O, A, B).
 * Permet de déterminer l'orientation du tour.
 * Retourne :
 * > 0 : Tourne à gauche (Sens anti-horaire)
 * < 0 : Tourne à droite (Sens horaire)
 * = 0 : Les points sont alignés (Colinéaires)
 */
const crossProduct = (o, a, b) => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

/**
 * Calcule l'Enveloppe Convexe (Convex Hull) d'un ensemble de points.
 * Algorithme : Chaîne Monotone d'Andrew.
 * Complexité : O(n log n) à cause du tri.
 * * @param {Array<{id, x, y}>} points - Tableau d'objets contenant x et y.
 * @returns {Array<{id, x, y}>} - Tableau ordonné des points formant le périmètre.
 */
export default function getConvexHull(points) {
    const n = points.length;
    // S'il y a moins de 3 points, l'enveloppe est simplement la liste des points.
    if (n <= 2) return points;

    // 1. TRIER les points
    // Important : on utilise [...points] pour créer une copie et NE PAS modifier 
    // l'ordre du tableau original (Redux/React friendly).
    const sortedPoints = [...points].sort((a, b) => {
        // Tri par X croissant, puis par Y croissant si égalité
        return a.x === b.x ? a.y - b.y : a.x - b.x;
    });

    // 2. Construire la chaîne inférieure (Lower Hull)
    const lower = [];
    for (let i = 0; i < n; i++) {
        // Tant qu'il y a au moins 2 points dans la pile et qu'on ne tourne pas à gauche (<= 0),
        // c'est que le dernier point ajouté est "à l'intérieur", on le retire.
        while (
            lower.length >= 2 &&
            crossProduct(lower[lower.length - 2], lower[lower.length - 1], sortedPoints[i]) <= 0
        ) {
            lower.pop();
        }
        lower.push(sortedPoints[i]);
    }

    // 3. Construire la chaîne supérieure (Upper Hull)
    const upper = [];
    for (let i = n - 1; i >= 0; i--) {
        // Même logique mais en parcourant la liste triée à l'envers
        while (
            upper.length >= 2 &&
            crossProduct(upper[upper.length - 2], upper[upper.length - 1], sortedPoints[i]) <= 0
        ) {
            upper.pop();
        }
        upper.push(sortedPoints[i]);
    }

    // 4. Fusionner les deux chaînes
    // Le dernier point de 'lower' est le même que le premier de 'upper', et vice versa.
    // On retire le dernier élément de chaque tableau pour éviter les doublons aux points de jonction.
    lower.pop();
    upper.pop();

    return lower.concat(upper);
}