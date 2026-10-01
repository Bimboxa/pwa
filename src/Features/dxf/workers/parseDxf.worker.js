import prepareDxf from "../utils/prepareDxf.js";

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ drawing: prepareDxf(data) });
  } catch (error) {
    self.postMessage({ error: error.message || "Impossible de lire ce DXF." });
  }
};
