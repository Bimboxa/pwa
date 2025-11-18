// Color definitions in HSV
const COLOR_RANGES = {
  red: [
    { lower: [0, 50, 50], upper: [10, 255, 255] },
    { lower: [170, 50, 50], upper: [180, 255, 255] },
  ],
  green: [{ lower: [40, 50, 50], upper: [80, 255, 255] }],
  blue: [{ lower: [100, 50, 50], upper: [130, 255, 255] }],
  yellow: [{ lower: [20, 50, 50], upper: [30, 255, 255] }],
  orange: [{ lower: [10, 50, 50], upper: [20, 255, 255] }],
  purple: [{ lower: [130, 50, 50], upper: [170, 255, 255] }],
};

/**
 * Wait for OpenCV to be loaded
 */
function waitForOpencv(callbackFn, waitTimeMs = 50000, stepTimeMs = 100) {
  if (typeof cv !== "undefined" && cv.Mat) {
    callbackFn(true);
    return;
  }

  let timeSpentMs = 0;
  const interval = setInterval(() => {
    const limitReached = timeSpentMs > waitTimeMs;
    if ((typeof cv !== "undefined" && cv.Mat) || limitReached) {
      clearInterval(interval);
      return callbackFn(
        !limitReached && typeof cv !== "undefined" && cv.Mat
      );
    } else {
      timeSpentMs += stepTimeMs;
    }
  }, stepTimeMs);
}

/**
 * Convert cv.Mat to ImageData
 */
function imageDataFromMat(mat) {
  // converts the mat type to cv.CV_8U
  const img = new cv.Mat();
  const depth = mat.type() % 8;
  const scale =
    depth <= cv.CV_8S ? 1.0 : depth <= cv.CV_32S ? 1.0 / 256.0 : 255.0;
  const shift = depth === cv.CV_8S || depth === cv.CV_16S ? 128.0 : 0.0;
  mat.convertTo(img, cv.CV_8U, scale, shift);

  // converts the img type to cv.CV_8UC4
  switch (img.type()) {
    case cv.CV_8UC1:
      cv.cvtColor(img, img, cv.COLOR_GRAY2RGBA);
      break;
    case cv.CV_8UC3:
      cv.cvtColor(img, img, cv.COLOR_RGB2RGBA);
      break;
    case cv.CV_8UC4:
      break;
    default:
      throw new Error(
        "Bad number of channels (Source image must have 1, 3 or 4 channels)"
      );
  }
  const clampedArray = new ImageData(
    new Uint8ClampedArray(img.data),
    img.cols,
    img.rows
  );
  img.delete();
  return clampedArray;
}

/**
 * Load image data from URL
 */
async function loadImageDataFromUrl(url) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (typeof bitmap.close === "function") {
    bitmap.close();
  }
  return imageData;
}

/**
 * Build color ranges from color name or custom ranges
 */
function buildColorRanges(colorName, customColorRanges) {
  const ranges = [];
  if (Array.isArray(customColorRanges) && customColorRanges.length) {
    customColorRanges.forEach((range, idx) => {
      if (!range || !range.lower || !range.upper) return;
      ranges.push({
        key: range.name || `custom_${idx}`,
        lower: range.lower,
        upper: range.upper,
      });
    });
    return ranges;
  }
  if (colorName && COLOR_RANGES[colorName.toLowerCase()]) {
    COLOR_RANGES[colorName.toLowerCase()].forEach((range) => {
      ranges.push({
        key: colorName.toLowerCase(),
        lower: range.lower,
        upper: range.upper,
      });
    });
    return ranges;
  }
  Object.keys(COLOR_RANGES).forEach((name) => {
    COLOR_RANGES[name].forEach((range) => {
      ranges.push({ key: name, lower: range.lower, upper: range.upper });
    });
  });
  return ranges;
}

