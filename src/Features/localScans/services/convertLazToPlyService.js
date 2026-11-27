// Converts a LAS / LAZ point cloud to the binary PLY the scan pipeline
// stores and decodes (see workers/convertLaz.worker.js).
// → {file: File (.ply), importedFrom: {format, fileName, lasVersion,
//    pointFormat, sourceCount, skip, origin}}
//   skip    1 point kept out of `skip` (large clouds)
//   origin  subtracted from the source coordinates (georeferenced clouds)
export default function convertLazToPlyService(
  file,
  { signal, onProgress } = {}
) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/convertLaz.worker.js", import.meta.url),
      { type: "module" }
    );
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
        if (data.type === "ERROR")
          reject(
            Object.assign(
              new Error(
                data.message || "La conversion du fichier LAS / LAZ a échoué."
              ),
              { code: data.code }
            )
          );
        else resolve(data.result);
      }
    };
    worker.onerror = () => {
      clean();
      reject(new Error("La conversion du fichier LAS / LAZ a échoué."));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else worker.postMessage({ file });
  });
}
