async function findPattern({ msg, payload }) {
  const { patternData, imageData } = payload;
  const patternMat = cv.matFromImageData(patternData);
  const srcMat = cv.matFromImageData(imageData);

  console.log("service worker : find pattern");
  // Convert to grayscale (optional, might improve matching)
  const srcGray = new cv.Mat();
  cv.cvtColor(srcMat, srcGray, cv.COLOR_RGBA2GRAY);
  const patternGray = new cv.Mat();
  cv.cvtColor(patternMat, patternGray, cv.COLOR_RGBA2GRAY);

  // Apply template matching
  const result = new cv.Mat();
  cv.matchTemplate(srcGray, patternGray, result, cv.TM_CCOEFF_NORMED);

  // Create a new black image with the same dimensions as the original
  const redRectangleMat = new cv.Mat(
    srcMat.rows,
    srcMat.cols,
    cv.CV_8UC3,
    new cv.Scalar(0, 0, 0)
  ); // Black background

  // Find locations above a confidence threshold (adjust as needed)
  const matches = [];
  for (let y = 0; y < result.rows - patternGray.rows + 1; y++) {
    for (let x = 0; x < result.cols - patternGray.cols + 1; x++) {
      const matchValue = result.data[y * result.cols + x];
      if (matchValue > 0.8) {
        // Adjust threshold for better/faster detection
        matches.push({ x, y });
      }
    }
  }

  // Draw red rectangles on the black background
  for (const match of matches) {
    const topLeft = new cv.Point(match.x, match.y);
    const bottomRight = new cv.Point(
      match.x + patternGray.cols,
      match.y + patternGray.rows
    );
    cv.rectangle(
      redRectangleMat,
      topLeft,
      bottomRight,
      new cv.Scalar(255, 0, 0),
      -1
    ); // Red color, filled rectangle
  }

  // Release OpenCV.js resources (optional, but recommended for large datasets)
  srcMat.delete();
  patternMat.delete();
  srcGray.delete();
  patternGray.delete();
  result.delete();

  postMessage({ msg, payload: imageDataFromMat(redRectangleMat) });
}
