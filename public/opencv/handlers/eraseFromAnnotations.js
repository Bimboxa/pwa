async function eraseFromAnnotations({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        const { imageUrl, annotations } = payload || {};

        if (!imageUrl) throw new Error("imageUrl is required");
        if (!Array.isArray(annotations)) throw new Error("annotations array is required");

        // 1. Load Image
        const imageData = await loadImageDataFromUrl(imageUrl);
        const src = track(cv.matFromImageData(imageData)); // RGBA

        // 2. Prepare Accumulator Mask for Erasure
        // 0 = Keep (Background), 255 = Erase (The Polygon Area)
        const rows = src.rows;
        const cols = src.cols;
        const eraseMask = track(new cv.Mat.zeros(rows, cols, cv.CV_8UC1));

        // 3. Process Annotations
        for (const annotation of annotations) {
            if (annotation.type !== "POLYGON" && annotation.type !== "RECTANGLE") continue;
            // RECTANGLE is essentially a polygon for this purpose if points are provided
            // Assuming annotation.points is [{x,y}, ...]

            const points = annotation.points;
            if (!points || points.length < 3) continue;

            // Create a mask for THIS polygon
            // filled with 0
            const polyMask = track(new cv.Mat.zeros(rows, cols, cv.CV_8UC1));

            // Draw Outer Contour (White = 255)
            const ptsVector = track(new cv.MatVector());
            const contours = track(cv.matFromArray(points.length, 1, cv.CV_32SC2, points.flatMap(p => [p.x, p.y])));
            ptsVector.push_back(contours);
            cv.fillPoly(polyMask, ptsVector, new cv.Scalar(255));

            // Draw Holes (Black = 0) -> "Un-erase" the hole
            if (annotation.cuts && Array.isArray(annotation.cuts)) {
                for (const cutPoints of annotation.cuts) {
                    if (!cutPoints || cutPoints.length < 3) continue;

                    const cutVector = track(new cv.MatVector());
                    const cutContour = track(cv.matFromArray(cutPoints.length, 1, cv.CV_32SC2, cutPoints.flatMap(p => [p.x, p.y])));
                    cutVector.push_back(cutContour);

                    // Fill hole with 0 on the polyMask
                    cv.fillPoly(polyMask, cutVector, new cv.Scalar(0));
                }
            }

            // Accumulate to global eraseMask
            // If pixel is 255 in polyMask, it becomes 255 in eraseMask
            cv.bitwise_or(eraseMask, polyMask, eraseMask);
        }

        // 4. Apply Mask to Source
        // We want: Where eraseMask is 255 -> Alpha = 0
        //          Where eraseMask is 0   -> Alpha = Original OR 255

        // Split channels
        const channels = track(new cv.MatVector());
        cv.split(src, channels); // R, G, B, A

        const currentAlpha = channels.get(3);
        const finalAlpha = track(new cv.Mat());

        // Invert eraseMask: 255 (Erase) -> 0 (Transparent), 0 (Keep) -> 255 (Opaque)
        const invertedMask = track(new cv.Mat());
        cv.bitwise_not(eraseMask, invertedMask);

        // Combine current alpha with inverted mask
        // If original was transparent, it stays transparent.
        // If original was opaque, it becomes transparent ONLY if mask is 0.
        cv.bitwise_and(currentAlpha, invertedMask, finalAlpha);

        // Update Alpha Channel
        channels.set(3, finalAlpha);

        // Merge back
        const dst = track(new cv.Mat());
        cv.merge(channels, dst);

        // 5. Export
        const imgData = new ImageData(
            new Uint8ClampedArray(dst.data),
            dst.cols,
            dst.rows
        );

        const imageBitmap = await createImageBitmap(imgData);
        const canvas = new OffscreenCanvas(dst.cols, dst.rows);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();

        const blob = await canvas.convertToBlob({ type: "image/png" });
        const file = new File([blob], "erased_output.png", { type: "image/png", lastModified: Date.now() });

        postMessage({
            msg,
            payload: {
                processedImageFile: file
            }
        });

    } catch (err) {
        let errorMessage = err?.message || err;
        console.error("[opencv worker] eraseFromAnnotations failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}