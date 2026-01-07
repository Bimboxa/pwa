/**
 * Transforme une ImageData en mode "Darkview" :
 * - Convertit en niveaux de gris.
 * - Inverse les couleurs : le blanc devient un gris très foncé (fond),
 * et le noir devient un gris clair (traits).
 * - Gère la transparence : les pixels transparents deviennent du fond sombre.
 * @param {ImageData} sourceImageData 
 * @returns {ImageData}
 */
function createDarkViewImageData(sourceImageData) {
    const { width, height, data } = sourceImageData;
    const outputData = new Uint8ClampedArray(data.length);

    // --- CONFIGURATION DES COULEURS ---
    const DARK_BG = 25;    // Fond : Gris très foncé (presque noir)
    const LINE_GREY = 180; // Traits : Gris clair

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3]; // On récupère l'alpha source

        // --- MODIFICATION ICI ---
        // 1. Gestion des pixels "qui n'existent pas" (transparents)
        // Si l'alpha est nul (ou très faible), on le remplit avec la couleur de fond sombre.
        if (a === 0) {
            outputData[i] = DARK_BG;     // R
            outputData[i + 1] = DARK_BG; // G
            outputData[i + 2] = DARK_BG; // B
            outputData[i + 3] = 255;     // Alpha force à opaque
            continue; // On passe au pixel suivant
        }
        // -------------------------

        // 2. Conversion Niveaux de gris (Luminance perçue) pour les pixels existants
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // 3. Inversion et Mapping
        // Logique : 
        // - Blanc source (255) -> Ratio 1 -> Devient DARK_BG
        // - Noir source (0) -> Ratio 0 -> Devient LINE_GREY
        const ratio = gray / 255;

        // Interpolation linéaire inverse
        const val = (LINE_GREY * (1 - ratio)) + (DARK_BG * ratio);

        outputData[i] = val;     // R
        outputData[i + 1] = val; // G
        outputData[i + 2] = val; // B
        outputData[i + 3] = 255; // Alpha (Totalement opaque pour le résultat)
    }

    return new ImageData(outputData, width, height);
}