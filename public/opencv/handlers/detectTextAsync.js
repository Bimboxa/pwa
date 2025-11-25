/* eslint-disable no-undef */

// --- CONFIGURATION ---
const TESSERACT_VERSION = "5.1.0";
const CDN_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist`;
const WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const CORE_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}/tesseract-core.wasm.js`;

let tesseractWorkerInstance = null;
let tesseractWorkerPromise = null;

async function getTesseractWorker() {
  if (tesseractWorkerInstance) return tesseractWorkerInstance;
  if (tesseractWorkerPromise) return tesseractWorkerPromise;

  tesseractWorkerPromise = (async () => {
    try {
      if (typeof Tesseract === "undefined") {
        importScripts(`${CDN_BASE}/tesseract.min.js`);
      }

      console.log("[Tesseract] Initializing worker...");

      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        gzip: false,
        logger: () => {}, // Suppress logs for performance
      });

      tesseractWorkerInstance = worker;
      return worker;
    } catch (error) {
      console.error("[Tesseract] Initialization failed:", error);
      tesseractWorkerPromise = null;
      throw error;
    }
  })();

  return tesseractWorkerPromise;
}

const UPSCALE_FACTOR = 2;

async function detectTextAsync({ msg, payload }) {
  const matList = [];
  const track = (mat) => {
    if (mat) matList.push(mat);
    return mat;
  };

  try {
    const { imageUrl, x, y, windowSize = 50, bbox } = payload ?? {};

    if (
      !imageUrl ||
      (bbox === undefined && (x === undefined || y === undefined))
    ) {
      throw new Error("imageUrl and either bbox or x/y are required");
    }

    // --- OpenCV Processing ---
    const imageData = await loadImageDataFromUrl(imageUrl);
    const src = track(cv.matFromImageData(imageData));

    const imageWidth = src.cols;
    const imageHeight = src.rows;

    // ROI Calculations
    const winSize = Math.max(1, windowSize);
    let startX;
    let startY;
    let roiWidth;
    let roiHeight;

    if (bbox) {
      startX = Math.max(0, Math.min(imageWidth, Math.floor(bbox.x)));
      startY = Math.max(0, Math.min(imageHeight, Math.floor(bbox.y)));
      roiWidth = Math.min(bbox.width, imageWidth - startX);
      roiHeight = Math.min(bbox.height, imageHeight - startY);
    } else {
      const halfSize = Math.floor(winSize / 2);
      startX = Math.max(
        0,
        Math.min(imageWidth - winSize, Math.floor(x - halfSize))
      );
      startY = Math.max(
        0,
        Math.min(imageHeight - winSize, Math.floor(y - halfSize))
      );
      roiWidth = Math.min(winSize, imageWidth - startX);
      roiHeight = Math.min(winSize, imageHeight - startY);
    }

    if (roiWidth <= 0 || roiHeight <= 0)
      throw new Error("Invalid ROI dimensions");

    const roiRect = new cv.Rect(startX, startY, roiWidth, roiHeight);
    const roi = track(src.roi(roiRect));

    // Pre-processing
    const gray = track(new cv.Mat());
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

    const blurred = track(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

    const bw = track(new cv.Mat());
    cv.adaptiveThreshold(
      blurred,
      bw,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      11,
      2
    );

    // Upscale
    const upscaleSize = new cv.Size(
      bw.cols * UPSCALE_FACTOR,
      bw.rows * UPSCALE_FACTOR
    );
    const upscaled = track(new cv.Mat());
    cv.resize(bw, upscaled, upscaleSize, 0, 0, cv.INTER_CUBIC);

    // Convert to RGBA for output
    const upscaledRgba = track(new cv.Mat());
    cv.cvtColor(upscaled, upscaledRgba, cv.COLOR_GRAY2RGBA);

    // Get Raw ImageData
    const roiImageData = imageDataFromMat(upscaledRgba);

    // --- CRITICAL FIX: Convert Raw ImageData to PNG Blob ---
    // Tesseract cannot read raw ImageData streams easily.
    // We must wrap it in a standard image format (PNG) using OffscreenCanvas.
    const canvas = new OffscreenCanvas(roiImageData.width, roiImageData.height);
    const ctx = canvas.getContext("2d");
    ctx.putImageData(roiImageData, 0, 0);

    // Create a Blob. This adds the PNG headers Tesseract is looking for.
    const imageBlob = await canvas.convertToBlob({ type: "image/png" });

    // Clean up OpenCV memory BEFORE Tesseract (to save RAM)
    matList.forEach((m) => m && !m.isDeleted() && m.delete());
    matList.length = 0;

    // --- Tesseract Processing ---
    const tesseractWorker = await getTesseractWorker();

    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-",
    });

    // Pass the BLOB, not the ImageData
    const { data } = await tesseractWorker.recognize(imageBlob);
    const detectedText = data?.text?.trim() || "";

    postMessage({
      msg,
      payload: {
        text: detectedText,
      },
    });
  } catch (err) {
    let errorMessage = err;
    if (typeof err === "number") {
      try {
        if (cv.exceptionFromPtr) errorMessage = cv.exceptionFromPtr(err).msg;
      } catch (e) {
        errorMessage = `Unknown C++ Exception Pointer: ${err}`;
      }
    } else if (err?.message) {
      errorMessage = err.message;
    }
    console.error("[opencv worker] detectTextAsync failed", errorMessage);
    postMessage({ msg, error: errorMessage });
  } finally {
    if (typeof matList !== "undefined") {
      matList.forEach((m) => m && !m.isDeleted() && m.delete());
    }
  }
}
