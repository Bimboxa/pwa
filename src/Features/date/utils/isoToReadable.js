/**
 * Convertit "YYYY-MM-DD" en format lisible (ex: "26 novembre 2025")
 * @param {string} isoDate - La date au format ISO (ex: "2025-11-26")
 * @returns {string} La date formatée en français
 */
const isoToReadable = (isoDate) => {
    if (!isoDate) return "";

    // Astuce : On force l'heure à midi pour éviter les décalages de fuseaux horaires
    // qui pourraient faire passer la date à la veille (ex: 25 novembre à 23h00).
    const date = new Date(isoDate + 'T12:00:00');

    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long', // 'long' = novembre, 'short' = nov., 'numeric' = 11
        year: 'numeric'
    });
};

export default isoToReadable;

// --- EXEMPLE ---
// console.log(isoToReadable("2025-11-26"));
// Résultat : "26 novembre 2025"