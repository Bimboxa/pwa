async function applyMorphologyAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        let processedImageFile = null;

        const {
            imageUrl,
            morphType = "open",
            kernelSize = 5,
        } = payload ?? {};

        if (!imageUrl) throw new Error("imageUrl is required");

        // 1. Load image (JS side only, no WASM allocation)
        const imageData = await loadImageDataFromUrl(imageUrl);
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // 2. Extract grayscale in JS (avoids creating a large RGBA mat in WASM)
        const pixelCount = width * height;
        const grayData = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const off = i * 4;
            grayData[i] = Math.round(
                0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]
            );
        }

        // 3. Create single-channel mat and apply morphology (minimal WASM memory)
        const gray = track(cv.matFromArray(height, width, cv.CV_8UC1, grayData));
        const kernel = track(
            cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize))
        );
        const result = track(new cv.Mat());

        // On grayscale with dark content on white background:
        // - "open" (erase thin dark lines) = MORPH_CLOSE in OpenCV (dilate white then erode)
        // - "close" (fill white holes in dark content) = MORPH_OPEN in OpenCV (erode white then dilate)
        const morphTypeConstant = morphType === "open" ? cv.MORPH_CLOSE : cv.MORPH_OPEN;
        cv.morphologyEx(gray, result, morphTypeConstant, kernel);

        // 4. Write result back to pixel data in JS (avoids GRAY2RGBA mat in WASM)
        const resultData = result.data;
        for (let i = 0; i < pixelCount; i++) {
            const off = i * 4;
            const v = resultData[i];
            data[off] = v;
            data[off + 1] = v;
            data[off + 2] = v;
            // alpha unchanged
        }

        // 5. Export to File
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.putImageData(imageData, 0, 0);

        const blob = await canvas.convertToBlob({ type: "image/png" });
        const fileName = `processed_morph_${morphType}_${kernelSize}_${Date.now()}.png`;

        processedImageFile = new File([blob], fileName, {
            type: "image/png",
            lastModified: Date.now(),
        });

        postMessage({
            msg,
            payload: { processedImageFile },
        });
    } catch (err) {
        let errorMessage = err?.message || err;
        if (typeof err === "number" && cv.exceptionFromPtr)
            errorMessage = cv.exceptionFromPtr(err).msg;
        console.error("[opencv worker] applyMorphologyAsync failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach((m) => m && !m.isDeleted() && m.delete());
    }
}
