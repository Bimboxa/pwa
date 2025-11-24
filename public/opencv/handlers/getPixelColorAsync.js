async function getPixelColorAsync({ msg, payload }) {
  try {
    const { imageUrl, x, y } = payload || {};

    if (!imageUrl || x === undefined || y === undefined) {
      throw new Error("imageUrl, x, and y are required");
    }

    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = cv.matFromImageData(imageData);

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    let pixelX, pixelY;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      pixelX = Math.floor(x * imageWidth);
      pixelY = Math.floor(y * imageHeight);
    } else {
      pixelX = Math.floor(x);
      pixelY = Math.floor(y);
    }

    if (
      pixelX < 0 ||
      pixelX >= imageWidth ||
      pixelY < 0 ||
      pixelY >= imageHeight
    ) {
      src.delete();
      throw new Error(
        `Coordinates (${pixelX}, ${pixelY}) are out of bounds for image size (${imageWidth}, ${imageHeight})`
      );
    }

    const pixelPtr = src.ucharPtr(pixelY, pixelX);
    const seedColor = {
      r: pixelPtr[0],
      g: pixelPtr[1],
      b: pixelPtr[2],
      alpha: pixelPtr[3],
    };

    const colorHex =
      "#" +
      [seedColor.r, seedColor.g, seedColor.b]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");

    src.delete();

    postMessage({
      msg,
      payload: {
        seedColor,
        colorHex,
      },
    });
  } catch (error) {
    console.error("[opencv worker] getPixelColorAsync failed", error);
    postMessage({ msg, error: error?.message || String(error) });
  }
}
