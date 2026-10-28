// One job in a short-lived worker (the one of useScanProjection): the
// positions / colors are cloned there and released with the worker.
function runLocalScanWorkerJob(data, type, query) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/projectLocalScan.worker.js", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = ({ data: message }) => {
      worker.terminate();
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("La projection a échoué."));
    };
    worker.postMessage({
      type: "INIT",
      source: { positions: data.positions, colors: data.colors },
    });
    worker.postMessage({ type, id: 1, query });
  });
}

// query: {frame, lower, upper, resolution?} → projectLocalScanSlice result
export default function projectLocalScanInWorker(data, query) {
  return runLocalScanWorkerJob(data, "PROJECT", query);
}

// frame: getLocalScanHeightFrame result → rasterizeLocalScanHeightMap result
export function buildLocalScanHeightMapInWorker(data, frame) {
  return runLocalScanWorkerJob(data, "HEIGHT_MAP", frame);
}

// query: {frame, raster, range} → projectLocalScanHeightPreview result
export function buildLocalScanHeightPreviewInWorker(data, query) {
  return runLocalScanWorkerJob(data, "HEIGHT_PREVIEW", query);
}
