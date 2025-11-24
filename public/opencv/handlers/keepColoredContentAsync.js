function hexToRgb(hex) {
  if (!hex) return null;
  let value = hex.trim();
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (value.length !== 6) {
    return null;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }
  return { r, g, b };
}

async function keepColoredContentAsync({ msg, payload }) {
  try {
    const {
      imageUrl,
      colors = [],
      tolerance = 35, // distance in RGB space
      backgroundColor = [255, 255, 255, 255],
      bbox,
    } = payload ?? {};

    if (!imageUrl) {
      throw new Error("imageUrl is required");
    }

    const normalizedColors = Array.isArray(colors)
      ? colors.map((color) => hexToRgb(color)).filter((color) => color !== null)
      : [];

    if (normalizedColors.length === 0) {
      throw new Error("At least one valid color is required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData); // RGBA

    const rows = src.rows;
    const cols = src.cols;
    const channels = src.channels(); // should be 4 (RGBA)
    const totalPixels = rows * cols;
    const srcData = src.data;

    const toleranceSq = tolerance * tolerance;

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
      const rawStartX = Math.floor(bbox.x ?? 0);
      const rawStartY = Math.floor(bbox.y ?? 0);
      const widthPx = Math.floor(bbox.width);
      const heightPx = Math.floor(bbox.height);

      const clampedStartX = Math.min(cols, Math.max(rawStartX, 0));
      const clampedStartY = Math.min(rows, Math.max(rawStartY, 0));
      const effectiveWidth = widthPx - Math.max(0, clampedStartX - rawStartX);
      const effectiveHeight = heightPx - Math.max(0, clampedStartY - rawStartY);

      startX = clampedStartX;
      startY = clampedStartY;
      endX = Math.min(cols, startX + Math.max(0, effectiveWidth));
      endY = Math.min(rows, startY + Math.max(0, effectiveHeight));
    }

    const result = src.clone();
    const resultData = result.data;
    const backgroundR = backgroundColor[0] ?? 255;
    const backgroundG = backgroundColor[1] ?? 255;
    const backgroundB = backgroundColor[2] ?? 255;
    const backgroundA = backgroundColor[3] ?? 255;

    for (let y = startY; y < endY; y++) {
      const rowOffset = y * cols;
      for (let x = startX; x < endX; x++) {
        const i = rowOffset + x;
        const idx = i * channels;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];

        let matches = false;
        for (let j = 0; j < normalizedColors.length; j++) {
          const ref = normalizedColors[j];
          const dr = r - ref.r;
          const dg = g - ref.g;
          const db = b - ref.b;
          if (dr * dr + dg * dg + db * db <= toleranceSq) {
            matches = true;
            break;
          }
        }

        if (!matches) {
          resultData[idx] = backgroundR;
          resultData[idx + 1] = backgroundG;
          resultData[idx + 2] = backgroundB;
          resultData[idx + 3] = backgroundA;
        }
      }
    }

    const borderThickness = 2;
    const borderR = 255;
    const borderG = 0;
    const borderB = 0;
    const borderA = 255;

    const drawBorderPixel = (x, y) => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const idx = (y * cols + x) * channels;
      resultData[idx] = borderR;
      resultData[idx + 1] = borderG;
      resultData[idx + 2] = borderB;
      resultData[idx + 3] = borderA;
    };

    for (let t = 0; t < borderThickness; t++) {
      for (let x = startX; x < endX; x++) {
        drawBorderPixel(x, startY + t);
        drawBorderPixel(x, endY - 1 - t);
      }
      for (let y = startY; y < endY; y++) {
        drawBorderPixel(startX + t, y);
        drawBorderPixel(endX - 1 - t, y);
      }
    }

    let resultImageBase64 = null;
    try {
      const resultImageData = imageDataFromMat(result);
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
      console.error(
        "[keepColoredContentAsync] Failed to convert result to base64",
        error
      );
    }

    src.delete();
    result.delete();

    postMessage({
      msg,
      payload: {
        resultImageBase64,
      },
    });
  } catch (error) {
    console.error("[opencv worker] keepColoredContentAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
