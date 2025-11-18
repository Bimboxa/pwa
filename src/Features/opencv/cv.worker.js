import getPixelsCountByColorAsync from "./utils/getPixelsCountByColorAsync";

/**
 *  Here we will check from time to time if we can access the OpenCV
 *  functions. We will return in a callback if it's been resolved
 *  well (true) or if there has been a timeout (false).
 */
function waitForOpencv(callbackFn, waitTimeMs = 50000, stepTimeMs = 100) {
  if (cv.Mat) callbackFn(true);

  let timeSpentMs = 0;
  const interval = setInterval(() => {
    const limitReached = timeSpentMs > waitTimeMs;
    if (cv.Mat || limitReached) {
      clearInterval(interval);
      return callbackFn(!limitReached);
    } else {
      timeSpentMs += stepTimeMs;
    }
  }, stepTimeMs);
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = function (e) {
  switch (e.data.msg) {
    case "load": {
      // Import Webassembly script
      self.importScripts("./opencv.js");
      //self.importScripts("./opencv_3_4_custom_O3.js");
      waitForOpencv(function (success) {
        if (success) postMessage({ msg: e.data.msg });
        else throw new Error("Error on loading OpenCV");
      });
      break;
    }
    case "getPixelsCountByColorAsync":
      return getPixelsCountByColorAsync(e.data);

    case "imageProcessing":
      return imageProcessing(e.data);

    case "highlightDifferences":
      return highlightDifferences(e.data);
    default:
      break;
  }
};

function imageProcessing({ msg, payload }) {
  const img = cv.matFromImageData(payload);
  let result = new cv.Mat();

  // This converts the image to a greyscale.
  cv.cvtColor(img, result, cv.COLOR_BGR2GRAY);
  postMessage({ msg, payload: imageDataFromMat(result) });
}

/**
 * This exists return an url with red = deleted point and green = new points
 */

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
  //cv.absdiff(gray2, gray1, diff);

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
        //result.ucharAt(y, 4 * x) = 0; // Blue (set to 0 for transparency)
        result.ucharPtr(y, x)[0] = 0;
        //result.ucharAt(y, 4 * x + 1) = 255; // Green (set to 0 for transparency)
        result.ucharPtr(y, x)[1] = 255;
        //result.ucharAt(y, 4 * x + 2) = 255; // Red
        result.ucharPtr(y, x)[2] = 0;
        //result.ucharAt(y, 4 * x + 3) = 255; // Alpha (full opacity)
        result.ucharPtr(y, x)[3] = 255;
      } else if (pixelDiff > threshold && isDeleted) {
        // Highlight deleted pixels (in image2) in red
        //result.ucharAt(y, 4 * x) = 0; // Blue (set to 0 for transparency)
        result.ucharPtr(y, x)[0] = 255;
        //result.ucharAt(y, 4 * x + 1) = 255; // Green
        result.ucharPtr(y, x)[1] = 0;
        //result.ucharAt(y, 4 * x + 2) = 0; // Red (set to 0 for transparency)
        result.ucharPtr(y, x)[2] = 0;
        //result.ucharAt(y, 4 * x + 3) = 255; // Alpha (full opacity)
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

/**
 * This function find the pattern inside one image
 */

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

/**
 * This function converts again from cv.Mat to ImageData
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
