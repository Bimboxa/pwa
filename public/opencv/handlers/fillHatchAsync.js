/**
 * Detect and fill 45-degree hatched zones using HoughLinesP.
 *
 * Payload:
 *   imageUrl        – (required) URL of the image to process
 *   fillColor       – hex color string to fill hatched areas (default "#808080")
 *   angleTolerance  – degrees of tolerance around 45°/135° (default 10)
 *   houghThreshold  – accumulator threshold for HoughLinesP (default 20)
 *   minLineLength   – minimum line length in pixels (default 10)
 *   maxLineGap      – maximum gap between line segments (default 5)
 *   lineThickness   – thickness when drawing lines on mask (default 6)
 *   morphCloseSize  – kernel size for morphological closing (default 5)
 */
async function fillHatchAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const {
      imageUrl,
      fillColor = "#808080",
      angleTolerance = 10,
      houghThreshold = 20,
      minLineLength = 10,
      maxLineGap = 5,
      lineThickness = 6,
      morphCloseSize = 5,
    } = payload ?? {};

    if (!imageUrl) throw new Error("imageUrl is required");

    // 1. Load image
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    // 2. Convert to grayscale
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 3. Canny edge detection
    const edges = track(new cv.Mat());
    cv.Canny(gray, edges, 50, 150, 3);

    // 4. HoughLinesP
    const lines = track(new cv.Mat());
    cv.HoughLinesP(
      edges,
      lines,
      1,
      Math.PI / 180,
      houghThreshold,
      minLineLength,
      maxLineGap
    );

    // 5. Filter by angle and draw on mask
    const mask = track(cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1));
    const white = new cv.Scalar(255, 255, 255, 255);

    for (let i = 0; i < lines.rows; ++i) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];

      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      const absAngle = Math.abs(angle);

      // Target ~45° or ~135° (same diagonal direction, opposite sign)
      const is45 =
        absAngle > 45 - angleTolerance && absAngle < 45 + angleTolerance;
      const is135 =
        absAngle > 135 - angleTolerance && absAngle < 135 + angleTolerance;

      if (is45 || is135) {
        const p1 = new cv.Point(x1, y1);
        const p2 = new cv.Point(x2, y2);
        cv.line(mask, p1, p2, white, lineThickness);
      }
    }

    // 6. Morphological closing to merge nearby lines
    const ksize = new cv.Size(morphCloseSize, morphCloseSize);
    const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, ksize));
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

    // 7. Parse fill color from hex
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);

    // 8. Apply fill color where mask is white
    const dst = track(new cv.Mat());
    src.copyTo(dst);
    const fillMat = track(
      new cv.Mat(src.rows, src.cols, src.type(), [r, g, b, 255])
    );
    fillMat.copyTo(dst, mask);

    // 9. Export to File
    const resultImageData = imageDataFromMat(dst);
    const canvas = new OffscreenCanvas(
      resultImageData.width,
      resultImageData.height
    );
    const ctx = canvas.getContext("2d");
    ctx.putImageData(resultImageData, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const fileName = `fill_hatch_${Date.now()}.png`;
    const processedImageFile = new File([blob], fileName, {
      type: "image/png",
      lastModified: Date.now(),
    });

    postMessage({
      msg,
      payload: { processedImageFile },
    });
  } catch (err) {
    let errorMessage = err?.message || err;
    if (typeof err === "number" && cv.exceptionFromPtr) {
      errorMessage = cv.exceptionFromPtr(err).msg;
    }
    console.error("[opencv worker] fillHatchAsync failed", errorMessage);
    postMessage({ msg, error: errorMessage });
  } finally {
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
  }
}
