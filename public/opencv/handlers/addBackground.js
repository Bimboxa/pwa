async function addBackground({ msg, payload }) {
    const matList = [];
    const track = (mat) => {
        if (mat) matList.push(mat);
        return mat;
    };

    try {
        const { imageUrl, bgColor } = payload || {};

        if (!imageUrl) throw new Error("imageUrl is required");
        if (!bgColor) throw new Error("bgColor is required");

        // Helper to parse Hex to RGB
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        const color = hexToRgb(bgColor);
        if (!color) throw new Error("Invalid bgColor format");

        // 1. Load Image
        const imageData = await loadImageDataFromUrl(imageUrl);
        const src = track(cv.matFromImageData(imageData)); // RGBA

        const rows = src.rows;
        const cols = src.cols;

        // 2. Create Background Mat
        // Create an opaque background with the specified color
        const background = track(new cv.Mat(rows, cols, cv.CV_8UC4, new cv.Scalar(color.r, color.g, color.b, 255)));

        // 3. Composite Source over Background
        // Since src has alpha, we need to handle blending manually or use a trick.
        // Simple 3-step composition:
        // A. Split src into RGB and Alpha
        const channels = track(new cv.MatVector());
        cv.split(src, channels);
        const alpha = channels.get(3); // The alpha channel
        const alphaInv = track(new cv.Mat());

        // Invert alpha: 255 - alpha
        cv.bitwise_not(alpha, alphaInv);

        // Convert single channel alphas to 3 channels for multiplication (or just use element-wise)
        // Actually simplest way in OpenCV.js for A over B:
        // dst = src * alpha + bg * (1 - alpha)

        // Let's do it byte-wise which is fast enough or use separate channels

        // Create float representations for accurate blending?
        // Or strictly strictly:
        // Background masked where src is opaque? No, it's blending.

        // Alternative: Draw image onto canvas filled with color.
        // Since we already are in a worker environment with OffscreenCanvas (used in loadImageDataFromUrl),
        // we can just use Canvas API for composition which is native and fast for this purpose.
        // OpenCV is overkill for simple "A over B" unless we need specific CV operations.
        // However, user asked to follow architecture of eraseFromAnnotations (which implies using mats generally),
        // but for "addBackground", Canvas `globalCompositeOperation` 'destination-over' is perfect.

        // Let's stick to the request "return an image file...".
        // Using Canvas API is cleaner for rendering layers.

        const canvas = new OffscreenCanvas(cols, rows);
        const ctx = canvas.getContext("2d");

        // 1. Fill Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cols, rows);

        // 2. Draw Image
        const imageBitmap = await createImageBitmap(imageData);
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();

        // 3. Output
        const blob = await canvas.convertToBlob({ type: "image/png" });
        const file = new File([blob], "background_output.png", { type: "image/png", lastModified: Date.now() });

        postMessage({
            msg,
            payload: {
                processedImageFile: file
            }
        });

    } catch (err) {
        let errorMessage = err?.message || err;
        console.error("[opencv worker] addBackground failed", errorMessage);
        postMessage({ msg, error: errorMessage });
    } finally {
        matList.forEach(m => m && !m.isDeleted() && m.delete());
    }
}
