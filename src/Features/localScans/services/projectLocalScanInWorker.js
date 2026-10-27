// One projection in a short-lived worker (the one of useScanProjection):
// the positions / colors are cloned there and released with the worker.
// query: {frame, lower, upper, resolution?} → projectLocalScanSlice result
export default function projectLocalScanInWorker(data, query) {
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
    worker.postMessage({ type: "PROJECT", id: 1, query });
  });
}
