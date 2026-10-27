// read: readLocalPly options (maxPoints, zone) for the points decode.
export default function readLocalScanInWorker(
  file,
  { signal, onProgress, decodeSplats = false, read } = {}
) {
  return new Promise((resolve, reject) => {
    const worker = decodeSplats
      ? new Worker(
          new URL("../workers/decodeLocalSplats.worker.js", import.meta.url),
          { type: "module" }
        )
      : new Worker(new URL("../workers/localScan.worker.js", import.meta.url), {
          type: "module",
        });
    const clean = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      clean();
      reject(new DOMException("Import cancelled", "AbortError"));
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "PROGRESS") onProgress?.(data.ratio);
      else {
        clean();
        if (data.type === "ERROR") reject(new Error(data.message));
        else resolve(data.result);
      }
    };
    worker.onerror = () => {
      clean();
      reject(new Error("Le traitement du scan a échoué."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else worker.postMessage({ file, options: read });
  });
}
