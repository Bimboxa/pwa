import { PackedSplats, SplatFileType } from "@sparkjsdev/spark";

// Confine Spark's decoder pool (and its WASM heap) to a short-lived worker.
// Terminating this worker also terminates its nested decoder workers, including
// on cancellation. The main thread only receives packed GPU data.
self.onmessage = async ({ data: { file } }) => {
  try {
    const splats = new PackedSplats({
      stream: file.stream(),
      streamLength: file.size,
      fileName: file.name || "scan.ply",
      fileType: SplatFileType.PLY,
    });
    await splats.initialized;
    const extra = {};
    const transfers = [splats.packedArray.buffer];
    for (const key of ["sh1", "sh2", "sh3"]) {
      if (splats.extra[key]) {
        extra[key] = splats.extra[key];
        transfers.push(extra[key].buffer);
      }
    }
    self.postMessage(
      {
        type: "RESULT",
        result: {
          packedArray: splats.packedArray,
          numSplats: splats.numSplats,
          splatEncoding: splats.splatEncoding,
          extra,
        },
      },
      transfers
    );
  } catch (error) {
    self.postMessage({ type: "ERROR", message: error.message });
  }
};
