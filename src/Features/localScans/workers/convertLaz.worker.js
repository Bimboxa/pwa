import { createLazPerf } from "laz-perf/lib/worker/index.js";
import lazPerfWasmUrl from "laz-perf/lib/laz-perf.wasm?url";

import convertLasToPly from "../utils/convertLasToPly.js";

// LAS / LAZ → binary PLY, once, at import (see utils/convertLasToPly.js).
// The LASzip chunk decoder (laz-perf, WASM) is only instantiated for a
// compressed file.
self.onmessage = async ({ data }) => {
  // the bar only moves by whole percents: no message per chunk
  let lastPercent = -1;
  const onProgress = (ratio) => {
    const percent = Math.floor(ratio * 100);
    if (percent === lastPercent) return;
    lastPercent = percent;
    self.postMessage({ type: "PROGRESS", ratio });
  };
  try {
    const result = await convertLasToPly(data.file, {
      createLazPerf: () => createLazPerf({ locateFile: () => lazPerfWasmUrl }),
      onProgress,
    });
    self.postMessage({ type: "RESULT", result });
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      message: error?.message,
      code: error?.code,
    });
  }
};
