import projectLocalScanSlice from "../utils/projectLocalScanSlice.js";
import rasterizeLocalScanHeightMap from "../utils/rasterizeLocalScanHeightMap.js";

let source,
  pending,
  running = false,
  latestId = 0;
async function drain() {
  if (running || !source) return;
  running = true;
  try {
    while (pending) {
      const job = pending;
      pending = null;
      try {
        if (job.type === "HEIGHT_MAP") {
          // Height map of a scan base map (one shot, no cancellation).
          const result = rasterizeLocalScanHeightMap(
            source.positions,
            job.query
          );
          if (latestId === job.id)
            self.postMessage({ id: job.id, result }, [result.data.buffer]);
          continue;
        }
        const result = await projectLocalScanSlice(source, job.query, {
          isCancelled: () => latestId !== job.id,
          yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
        });
        if (result && latestId === job.id)
          self.postMessage({ id: job.id, result }, [
            result.rgb.buffer,
            result.density.buffer,
          ]);
      } catch (error) {
        if (latestId === job.id)
          self.postMessage({ id: job.id, error: error.message });
      }
    }
  } finally {
    running = false;
  }
}
self.onmessage = ({ data }) => {
  if (data.type === "INIT") {
    source = data.source;
    return;
  }
  latestId = data.id;
  if (data.type === "CANCEL") {
    pending = null;
    return;
  }
  pending = data;
  void drain();
};
