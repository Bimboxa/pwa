async function applyGrayLevelThresholdAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        // __ OUTPUT __
        let processedImageFile = null; // CHANGEMENT ICI

        // -- MAIN --
        const {
            imageUrl,
            grayLevelThreshold = 255
        } = payload ?? {};

        if (!imageUrl) throw new Error("imageUrl is required");

        // 1. Chargement (via helper ou cv.imread si dispo, ici via helper canvas)
        const imageData = await loadImageDataFromUrl(imageUrl);

        // On crée la Matrice
        const src = track(cv.matFromImageData(imageData));

        // 2. PIXEL MANIPULATION (Threshold avec Pente SVG)
        const data = src.data;
        const width = src.cols;
        const height = src.rows;

        const slope = 50;
        const threshold = grayLevelThreshold;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue;

            // Luminosité REC 709
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // Formule SVG : Alpha = AlphaOrigine + Slope * (Threshold - Luminance)
            let newAlpha = a + slope * (threshold - luminance);

            // Clamp 0-255
            if (newAlpha < 0) newAlpha = 0;
            if (newAlpha > 255) newAlpha = 255;

            data[i + 3] = newAlpha;
        }

        // 3. EXPORT VERS FILE
        // On crée un ImageData avec les pixels modifiés
        const finalImgData = new ImageData(
            new Uint8ClampedArray(src.data),
            width,
            height
        );

        // On dessine sur un OffscreenCanvas pour obtenir un Blob
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // putImageData est plus direct que drawImage quand on a déjà les pixels
        ctx.putImageData(finalImgData, 0, 0);

        // Conversion en Blob (PNG pour garder la transparence)
        const blob = await canvas.convertToBlob({ type: "image/png" });

        // --- CHANGEMENT MAJEUR ICI ---
        // Au lieu de convertir en Base64, on crée un File directement.
        // On donne un nom générique avec timestamp pour l'unicité
        const fileName = `processed_threshold_${Date.now()}.png`;

        processedImageFile = new File([blob], fileName, {
            type: "image/png",
            lastModified: Date.now()
        });

        // -----------------------------

        postMessage({
            msg,
            payload: { processedImageFile } // On renvoie l'objet File
        });

    } catch (err) {
        let errorMessage = err?.message || err;
        if (typeof err === "number" && cv.exceptionFromPtr) errorMessage = cv.exceptionFromPtr(err).msg;
        console.error("[opencv worker] applyThresholdAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}