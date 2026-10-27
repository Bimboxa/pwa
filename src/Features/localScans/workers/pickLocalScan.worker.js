import pickLocalScanPoint from "../utils/pickLocalScanPoint.js";

let positions;
self.onmessage = ({ data }) => {
  if (data.type === "INIT") {
    positions = data.positions;
    return;
  }
  try {
    self.postMessage({
      id: data.id,
      result: pickLocalScanPoint(positions, data.query),
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
