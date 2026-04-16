async function filterConnectedComponentsAsync({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        let processedImageFile = null;

        const {
            imageUrl,
            minArea = 200,
            textOnly = false,
        } = payload ?? {};

        if (!imageUrl) throw new Error("imageUrl is required");

        // 1. Load image (JS side only, no WASM allocation)
        const imageData = await loadImageDataFromUrl(imageUrl);
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // 2. Extract grayscale in JS
        const pixelCount = width * height;
        const grayData = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const off = i * 4;
            grayData[i] = Math.round(
                0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]
            );
        }

        // 3. Single-channel mat
        const gray = track(cv.matFromArray(height, width, cv.CV_8UC1, grayData));

        // 4. Binarize INV + OTSU: black ink -> 255 (foreground)
        const binary = track(new cv.Mat());
        cv.threshold(
            gray,
            binary,
            0,
            255,
            cv.THRESH_BINARY_INV + cv.THRESH_OTSU
        );

        // 5. Connected components with stats
        const labels = track(new cv.Mat());
        const stats = track(new cv.Mat());
        const centroids = track(new cv.Mat());
        const numLabels = cv.connectedComponentsWithStats(
            binary,
            labels,
            stats,
            centroids,
            8,
            cv.CV_32S
        );

        // 6. Build lookup: shouldRemove[label] = bool
        // Label 0 is background, keep it.
        const shouldRemove = new Uint8Array(numLabels);
        for (let label = 1; label < numLabels; label++) {
            const area = stats.intAt(label, cv.CC_STAT_AREA);
            const w = stats.intAt(label, cv.CC_STAT_WIDTH);
            const h = stats.intAt(label, cv.CC_STAT_HEIGHT);
            const bboxArea = w * h;
            const density = bboxArea > 0 ? area / bboxArea : 0;

            let remove = area < minArea;
            if (remove && textOnly) {
                // Only remove low-density blobs (text / cotations),
                // keep solid shapes like columns / poteaux.
                remove = density < 0.75;
            }
            if (remove) shouldRemove[label] = 1;
        }

        // 7. Paint removed components white in the RGBA output
        const labelsData = labels.data32S;
        for (let i = 0; i < pixelCount; i++) {
            const label = labelsData[i];
            if (label !== 0 && shouldRemove[label]) {
                const off = i * 4;
                data[off] = 255;
                data[off + 1] = 255;
                data[off + 2] = 255;
                // alpha unchanged
            }
        }

        // 8. Export to File
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        ctx.putImageData(imageData, 0, 0);

        const blob = await canvas.convertToBlob({ type: "image/png" });
        const fileName = `processed_filter_cc_${minArea}_${textOnly ? "text" : "all"}_${Date.now()}.png`;

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
        console.error(
            "[opencv worker] filterConnectedComponentsAsync failed",
            errorMessage
        );
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach((m) => m && !m.isDeleted() && m.delete());
    }
}
