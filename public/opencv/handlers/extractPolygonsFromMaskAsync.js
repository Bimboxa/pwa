

/**
 * Extrait des polygones simplifiés à partir d'une image DataURL (le masque dessiné)
 * @param {string} maskDataUrl - L'image du canvas (noir/transparent ou couleur/transparent)
 * @param {number} simplificationFactor - Facteur pour approxPolyDP (ex: 2.0)
 * @returns {Promise<Array<Array<{x, y}>>>} - Liste de contours (tableaux de points)
 */

async function extractPolygonsFromMaskAsync({ msg, payload }) {
    try {
        const { maskDataUrl, simplificationFactor = 2.0 } = payload;

        if (!maskDataUrl) {
            throw new Error("maskDataUrl is required");
        }

        const imageData = await loadImageDataFromUrl(maskDataUrl);
        const src = cv.matFromImageData(imageData);
        const gray = new cv.Mat();

        // 1. Convertir en Niveaux de gris (le dessin coloré devient gris, le transparent devient noir/blanc selon le fond)
        // On suppose que le canvas est sur fond transparent.
        // On extrait le canal Alpha pour être sûr d'avoir la forme
        const channels = new cv.MatVector();
        cv.split(src, channels);
        const alpha = channels.get(3); // Canal Alpha

        // 2. Threshold sur l'Alpha pour avoir un masque binaire strict
        const binary = new cv.Mat();
        cv.threshold(alpha, binary, 50, 255, cv.THRESH_BINARY);

        // 3. Trouver les contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        // RETR_EXTERNAL pour ne pas avoir les trous si on colorie mal, ou RETR_CCOMP pour gérer les trous
        // Ici on prend RETR_CCOMP pour supporter les "donuts" si l'utilisateur fait un trou
        cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

        const polygons = [];

        // 4. Approximation Polygonale (Simplification)
        for (let i = 0; i < contours.size(); ++i) {
            const contour = contours.get(i);

            // Filtrer les tout petits bruits
            const area = cv.contourArea(contour);
            if (area < 100) continue;

            const approx = new cv.Mat();
            // Epsilon : Plus il est grand, plus c'est simplifié
            cv.approxPolyDP(contour, approx, simplificationFactor, true);

            const points = [];
            for (let j = 0; j < approx.rows; ++j) {
                points.push({
                    x: approx.data32S[j * 2],
                    y: approx.data32S[j * 2 + 1]
                });
            }
            polygons.push(points);

            approx.delete();
        }

        // Cleanup
        src.delete();
        gray.delete();
        channels.delete();
        alpha.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();

        postMessage({
            msg,
            payload: polygons // [ [{x,y}, ...], ... ]
        });

    } catch (e) {
        console.error("[opencv worker] extractPolygonsFromMaskAsync failed", e);
        postMessage({ msg, error: e?.message || String(e) });
    }
}