// Wait for cv to be available globally
function waitForCV() {
  return new Promise((resolve, reject) => {
    if (typeof cv !== "undefined" && cv.Mat) {
      resolve(cv);
      return;
    }

    let attempts = 0;
    const maxAttempts = 100;
    const interval = setInterval(() => {
      attempts++;
      if (typeof cv !== "undefined" && cv.Mat) {
        clearInterval(interval);
        resolve(cv);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error("OpenCV failed to load"));
      }
    }, 100);
  });
}

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

export default async function getPixelsCountByColorAsync({ message, payload }) {
  const { imageUrl, colorName, customColorRanges } = payload;

  // Ensure cv is loadeds
  const cv = await waitForCV();

  // Load image from URL
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imageUrl;
  });

  // Create canvas to get image data
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert to cv.Mat
  const src = cv.matFromImageData(imageData);

  // Convert to HSV for better color matching
  const hsv = new cv.Mat();
  cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const results = {};

  // Determine which color ranges to use
  let colorRangesToProcess = [];

  if (customColorRanges && Array.isArray(customColorRanges)) {
    colorRangesToProcess = customColorRanges;
  } else if (colorName && COLOR_RANGES[colorName.toLowerCase()]) {
    colorRangesToProcess = COLOR_RANGES[colorName.toLowerCase()].map(
      (range, idx) => ({
        name: `${colorName}_${idx}`,
        ...range,
      })
    );
  } else {
    // Default: process all colors
    Object.keys(COLOR_RANGES).forEach((color) => {
      COLOR_RANGES[color].forEach((range, idx) => {
        colorRangesToProcess.push({
          name: `${color}_${idx}`,
          ...range,
        });
      });
    });
  }

  // Process each color range
  for (const colorRange of colorRangesToProcess) {
    const { name, lower, upper } = colorRange;

    // Create mask for this color range
    const mask = new cv.Mat();
    const lowerBound = new cv.Scalar(lower[0], lower[1], lower[2]);
    const upperBound = new cv.Scalar(upper[0], upper[1], upper[2]);
    cv.inRange(hsv, lowerBound, upperBound, mask);

    // Count non-zero pixels (pixels matching the color range)
    const count = cv.countNonZero(mask);

    // Find contours for this color
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      mask,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Convert contours to array
    const contoursArray = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const points = [];
      for (let j = 0; j < contour.rows; j++) {
        points.push({
          x: contour.data32S[j * 2],
          y: contour.data32S[j * 2 + 1],
        });
      }
      contoursArray.push(points);
    }

    // Aggregate results by color name (without _idx suffix)
    const colorKey = name.split("_")[0];
    if (!results[colorKey]) {
      results[colorKey] = {
        pixelCount: 0,
        contours: [],
      };
    }
    results[colorKey].pixelCount += count;
    results[colorKey].contours.push(...contoursArray);

    // Cleanup
    mask.delete();
    contours.delete();
    hierarchy.delete();
  }

  // Cleanup
  src.delete();
  hsv.delete();

  return results;
}
