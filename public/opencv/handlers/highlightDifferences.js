function highlightDifferences({ msg, payload }) {
  const imageData1 = payload.imageData1;
  const imageData2 = payload.imageData2;
  const [img1, img2] = [
    cv.matFromImageData(imageData1),
    cv.matFromImageData(imageData2),
  ];

  // Check if images are loaded successfully
  if (!img1.data || !img2.data) {
    console.warn("Failed to load images. Please check the URLs.");
  }

  // Validate image dimensions (optional but recommended)
  if (img1.cols !== img2.cols || img1.rows !== img2.rows) {
    console.warn(
      "Images have different dimensions. Differences might not be accurate."
    );
  }

  // Convert to grayscale for efficient difference calculation (optional)
  const gray1 = new cv.Mat();
  const gray2 = new cv.Mat();
  cv.cvtColor(img1, gray1, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(img2, gray2, cv.COLOR_RGBA2GRAY);

  // Set a threshold for "almost white" pixels (adjust based on your image)
  const thresholdValue = 240; // Adjust the threshold for near-white pixels (0-255)

  // Create a new Mat to store the filtered image
  const filteredGray1 = new cv.Mat();
  const filteredGray2 = new cv.Mat();

  // Apply thresholding to remove near-white pixels
  cv.threshold(gray1, filteredGray1, thresholdValue, 255, cv.THRESH_BINARY_INV);
  cv.threshold(gray2, filteredGray2, thresholdValue, 255, cv.THRESH_BINARY_INV);

  // Calculate absolute difference between grayscale images
  const diff = new cv.Mat();
  cv.absdiff(filteredGray1, filteredGray2, diff);

  // Define threshold for significant difference (adjust as needed)
  const threshold = 25; // Pixels with difference above this will be highlighted

  // Create a mask to isolate areas with significant difference
  const mask = new cv.Mat();
  cv.threshold(diff, mask, threshold, 255, cv.THRESH_BINARY);

  // Create result image (initially black)
  const result = new cv.Mat.zeros(img1.rows, img1.cols, cv.CV_8UC4);

  // Channel-wise processing for red and green highlighting
  const data1 = filteredGray1.data;
  const data2 = filteredGray2.data;
  const cols = filteredGray1.cols;

  for (let y = 0; y < img1.rows; y++) {
    for (let x = 0; x < img1.cols; x++) {
      const pixelDiff = mask.ucharAt(y, x);
      const offset = y * cols + x;
      const isNew = data1[offset] <= threshold;
      const isDeleted = data2[offset] <= threshold;
      if (isNew && isDeleted) {
        // do nothing
      } else if (pixelDiff > threshold && isNew) {
        // Highlight added pixels (from image1) in green
        result.ucharPtr(y, x)[0] = 0;
        result.ucharPtr(y, x)[1] = 255;
        result.ucharPtr(y, x)[2] = 0;
        result.ucharPtr(y, x)[3] = 255;
      } else if (pixelDiff > threshold && isDeleted) {
        // Highlight deleted pixels (in image2) in red
        result.ucharPtr(y, x)[0] = 255;
        result.ucharPtr(y, x)[1] = 0;
        result.ucharPtr(y, x)[2] = 0;
        result.ucharPtr(y, x)[3] = 255;
      }
    }
  }

  // Release OpenCV.js resources (optional, but recommended)
  img1.delete();
  img2.delete();
  gray1.delete();
  gray2.delete();
  diff.delete();
  mask.delete();

  postMessage({ msg, payload: imageDataFromMat(result) });

  result.delete();
}

