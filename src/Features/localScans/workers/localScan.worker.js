import { readLocalPly } from "../utils/readLocalPly.js";
import convertAsciiPlyToBinary from "../utils/convertAsciiPlyToBinary.js";

self.onmessage = async ({ data }) => {
  const onProgress = (ratio) => self.postMessage({ type: "PROGRESS", ratio });
  try {
    if (data.convert) {
      const result = await convertAsciiPlyToBinary(data.file, onProgress);
      self.postMessage({ type: "RESULT", result });
      return;
    }
    const result = await readLocalPly(data.file, onProgress, data.options);
    self.postMessage({ type: "RESULT", result }, [
      result.positions.buffer,
      result.colors.buffer,
    ]);
  } catch (error) {
    self.postMessage({ type: "ERROR", message: error.message });
  }
};
