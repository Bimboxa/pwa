import { readLocalPly } from "../utils/readLocalPly.js";

self.onmessage = async ({ data }) => {
  try {
    const result = await readLocalPly(data.file, (ratio) =>
      self.postMessage({ type: "PROGRESS", ratio })
    );
    self.postMessage({ type: "RESULT", result }, [
      result.positions.buffer,
      result.colors.buffer,
    ]);
  } catch (error) {
    self.postMessage({ type: "ERROR", message: error.message });
  }
};
