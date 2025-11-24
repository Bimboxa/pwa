function clampRect(value, min, max) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

async function fillHatchAsync({ msg, payload }) {
  try {
    const { imageUrl, bbox } = payload ?? {};

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);

    const rows = src.rows;
    const cols = src.cols;
    const channels = src.channels();
    const data = src.data;

    let startX = 0;
    let startY = 0;
    let endX = cols;
    let endY = rows;

    if (
      bbox &&
      typeof bbox === "object" &&
      typeof bbox.width === "number" &&
      typeof bbox.height === "number" &&
      bbox.width > 0 &&
      bbox.height > 0
    ) {
      const rawStartX = Math.floor(clampRect(bbox.x ?? 0, -cols, cols));
      const rawStartY = Math.floor(clampRect(bbox.y ?? 0, -rows, rows));
      const widthPx = Math.floor(bbox.width);
      const heightPx = Math.floor(bbox.height);

      const clampedStartX = clampRect(rawStartX, 0, cols);
      const clampedStartY = clampRect(rawStartY, 0, rows);
      const effectiveWidth = Math.max(0, Math.min(widthPx, cols - clampedStartX));
      const effectiveHeight = Math.max(0, Math.min(heightPx, rows - clampedStartY));

      if (effectiveWidth > 0 && effectiveHeight > 0) {
        startX = clampedStartX;
        startY = clampedStartY;
        endX = startX + effectiveWidth;
        endY = startY + effectiveHeight;
      }
    }

    const borderThickness = 2;
    const borderColor = [255, 0, 0, 255];

    const drawPixel = (x, y) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const idx = (y * cols + x) * channels;
      data[idx] = borderColor[0];
      if (channels > 1) data[idx + 1] = borderColor[1];
      if (channels > 2) data[idx + 2] = borderColor[2];
      if (channels > 3) data[idx + 3] = borderColor[3];
    };

    for (let t = 0; t < borderThickness; t++) {
      for (let x = startX; x < endX; x++) {
        drawPixel(x, startY + t);
        drawPixel(x, endY - 1 - t);
      }
      for (let y = startY; y < endY; y++) {
        drawPixel(startX + t, y);
        drawPixel(endX - 1 - t, y);
      }
    }

    let resultImageBase64 = null;
    try {
      const resultImageData = imageDataFromMat(src);
      const canvas = new OffscreenCanvas(
        resultImageData.width,
        resultImageData.height
      );
      const ctx = canvas.getContext("2d");
      ctx.putImageData(resultImageData, 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binaryString = "";
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      resultImageBase64 = btoa(binaryString);
    } catch (error) {
      console.error("[fillHatchAsync] Failed to convert result to base64", error);
    }

    src.delete();

    postMessage({
      msg,
      payload: {
        resultImageBase64,
      },
    });
  } catch (error) {
    console.error("[opencv worker] fillHatchAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}

