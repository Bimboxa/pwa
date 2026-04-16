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

        // 1. Load image (JS side only, no WASM allocation)
        const imageData = await loadImageDataFromUrl(imageUrl);
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const pixelCount = width * height;

        // 2. Threshold on alpha channel (pure JS — no WASM mat needed)
        const slope = 50;
        const threshold = grayLevelThreshold;

        const alphaData = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const off = i * 4;
            const a = data[off + 3];
            if (a === 0) { alphaData[i] = 0; continue; }

            const luminance = 0.2126 * data[off] + 0.7152 * data[off + 1] + 0.0722 * data[off + 2];
            let newAlpha = a + slope * (threshold - luminance);
            if (newAlpha < 0) newAlpha = 0;
            if (newAlpha > 255) newAlpha = 255;
            alphaData[i] = newAlpha;
        }

        // 2b. Morphological close on alpha (single-channel mat — minimal WASM memory)
        const alphaMat = track(cv.matFromArray(height, width, cv.CV_8UC1, alphaData));
        const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2)));
        const closedAlpha = track(new cv.Mat());
        cv.morphologyEx(alphaMat, closedAlpha, cv.MORPH_CLOSE, kernel);

        // 3. Write closed alpha back into RGBA pixel data (JS side)
        const closedData = closedAlpha.data;
        for (let i = 0; i < pixelCount; i++) {
            data[i * 4 + 3] = closedData[i];
        }

        const finalImgData = imageData;

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