async function detectShapesAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        // --- CONSTANTE D'OPACITE DU FOND ---
        const BACKGROUND_OPACITY = 0.81;
        // -----------------------------------

        const { imageUrl, morphKernelSize = 3 } = payload ?? {};

        if (!imageUrl) {
            throw new Error("imageUrl is required");
        }

        const imageData = await loadImageDataFromUrl(imageUrl);
        // src est l'image originale en RGBA
        const src = track(cv.matFromImageData(imageData));

        // 1. PRE-PROCESS (Création du Masque)
        const gray = track(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const binary = track(new cv.Mat());
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

        // 2. MORPHOLOGICAL OPERATIONS (Nettoyage du Masque)
        const kSize = parseInt(morphKernelSize, 10) || 3;
        const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kSize, kSize)));

        // Etape A : Ouverture (Nettoyage bruit)
        const tempMat = track(new cv.Mat());
        cv.morphologyEx(binary, tempMat, cv.MORPH_OPEN, kernel);

        // Etape B : Fermeture (Bouchage trous)
        // processedMat est notre MASQUE final (Noir & Blanc)
        const processedMat = track(new cv.Mat());
        cv.morphologyEx(tempMat, processedMat, cv.MORPH_CLOSE, kernel);

        // 3. APPLICATION DU MASQUE SUR L'IMAGE ORIGINALE
        const maskedImage = track(new cv.Mat());
        // maskedImage contient l'original là où le masque est blanc, et de la transparence ailleurs.
        cv.bitwise_and(src, src, maskedImage, processedMat);

        // 4. COMPOSITION FINALE ET CONVERSION BASE64
        let processedImageUrl = null;

        const imgData = new ImageData(
            new Uint8ClampedArray(maskedImage.data),
            maskedImage.cols,
            maskedImage.rows
        );

        try {
            // On crée un bitmap à partir des données brutes pour pouvoir utiliser 'drawImage' (qui gère la composition)
            // au lieu de 'putImageData' (qui écrase les pixels).
            const imageBitmap = await createImageBitmap(imgData);

            const canvas = new OffscreenCanvas(maskedImage.cols, maskedImage.rows);
            const ctx = canvas.getContext("2d");

            // A. Remplir le fond avec du blanc semi-transparent
            // On utilise la constante définie au début
            ctx.fillStyle = `rgba(255, 255, 255, ${BACKGROUND_OPACITY})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // B. Dessiner l'image masquée par-dessus
            // Les zones transparentes de l'image laisseront voir le fond blanc créé juste avant.
            ctx.drawImage(imageBitmap, 0, 0);

            // Nettoyage du bitmap
            imageBitmap.close();


            const blob = await canvas.convertToBlob({ type: "image/png" });
            const buffer = await blob.arrayBuffer();

            let binaryString = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binaryString += String.fromCharCode(bytes[i]);
            }
            processedImageUrl = "data:image/png;base64," + btoa(binaryString);

        } catch (conversionError) {
            console.error("Error converting Mat to Base64/Composition:", conversionError);
        }

        postMessage({
            msg,
            payload: {
                processedImageUrl,
            }
        });

    } catch (err) {
        let errorMessage = err;
        if (typeof err === "number" && cv.exceptionFromPtr) {
            errorMessage = cv.exceptionFromPtr(err).msg;
        } else if (err?.message) {
            errorMessage = err.message;
        }
        console.error("[opencv worker] detectShapesAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}