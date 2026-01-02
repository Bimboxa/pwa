self.importScripts("./utils/getImageCenterColor.js");
self.importScripts("./utils/getSeparationLinesAsync.js");

async function detectShapesAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        // --- CONSTANTE D'OPACITE DU FOND ---
        // 0 = Transparent, 0.5 = Semi-transparent, 1 = Opaque
        const BACKGROUND_OPACITY = 0.8;
        // -----------------------------------

        // __ OUTPUT __
        let processedImageUrl = null;
        let centerColor = null;
        let separationLines = null;

        // -- MAIN --
        const { imageUrl, morphKernelSize = 3, rotation, keepBest = true } = payload ?? {};

        if (!imageUrl) throw new Error("imageUrl is required");

        const imageData = await loadImageDataFromUrl(imageUrl);
        centerColor = getImageCenterColor(imageData);

        const src = track(cv.matFromImageData(imageData));

        // 1. PRE-PROCESS
        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const binary = track(new cv.Mat());
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

        // 2. MORPHOLOGICAL
        const kSize = parseInt(morphKernelSize, 10) || 3;
        const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize)));
        const tempMat = track(new cv.Mat());
        cv.morphologyEx(binary, tempMat, cv.MORPH_OPEN, kernel);
        const processedMat = track(new cv.Mat());
        cv.morphologyEx(tempMat, processedMat, cv.MORPH_CLOSE, kernel);

        // --- CHANGEMENT ICI ---

        // 3. APPLICATION DU MASQUE SUR FOND BLANC AVEC OPACITÉ VARIABLE

        // On convertit 0-1 vers 0-255
        const alphaValue = Math.round(BACKGROUND_OPACITY * 255);

        // On initialise l'image finale avec du Blanc (255,255,255) et l'Alpha calculé
        const finalImage = track(new cv.Mat(
            src.rows,
            src.cols,
            src.type(),
            new cv.Scalar(255, 255, 255, alphaValue)
        ));

        // On copie l'originale par dessus, uniquement là où le masque l'autorise.
        // Les zones masquées garderont la couleur d'initialisation (Blanc + Alpha variable)
        src.copyTo(finalImage, processedMat);

        // ----------------------

        // 4. OUTPUT
        const imgData = new ImageData(
            new Uint8ClampedArray(finalImage.data),
            finalImage.cols,
            finalImage.rows
        );

        try {
            separationLines = await getSeparationLinesAsync({
                imageData: imgData,
                rotation: rotation,
                keepBest,
            });

            // -- PRE-PROCESSED IMAGE --
            const imageBitmap = await createImageBitmap(imgData);
            const canvas = new OffscreenCanvas(finalImage.cols, finalImage.rows);
            const ctx = canvas.getContext("2d");

            // NOTE : J'ai retiré le ctx.fillRect(...) car le fond blanc/transparent
            // est maintenant "incrusté" directement dans les pixels de l'image (imgData)
            // grâce à l'étape 3 OpenCV.
            ctx.drawImage(imageBitmap, 0, 0);

            imageBitmap.close();

            const blob = await canvas.convertToBlob({ type: "image/png" });
            const buffer = await blob.arrayBuffer();
            let binaryString = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) binaryString += String.fromCharCode(bytes[i]);
            processedImageUrl = "data:image/png;base64," + btoa(binaryString);

        } catch (conversionError) {
            console.error("Error converting Mat to Base64:", conversionError);
        }

        postMessage({
            msg,
            payload: { processedImageUrl, centerColor, separationLines }
        });

    } catch (err) {
        // ... (Gestion erreur identique)
        let errorMessage = err?.message || err;
        if (typeof err === "number" && cv.exceptionFromPtr) errorMessage = cv.exceptionFromPtr(err).msg;
        console.error("[opencv worker] detectShapesAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}