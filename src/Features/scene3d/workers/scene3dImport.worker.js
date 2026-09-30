// Import worker of the SCENE_3D annotations: everything CPU-heavy of a scan
// import runs here, off the main thread.
//   PARSE          {file}                  → CHUNK* / PROGRESS* / PARSED
//   ENCODE_TEXTURE {id, bitmap, maxSize}   → TEXTURE
// Errors: {type: "ERROR", id?, code, message}.
// Relative imports only (bundled as a separate worker chunk).

import parseScenePly from "../utils/parseScenePly.js";
import encodeBc1 from "../utils/encodeBc1.js";

function floorPowerOfTwo(value) {
  return Math.max(4, 2 ** Math.floor(Math.log2(Math.max(1, value))));
}

async function handleParse(file) {
  const source = {
    size: file.size,
    read: (start, end) => file.slice(start, end).arrayBuffer(),
  };
  let lastProgress = 0;
  const result = await parseScenePly(source, {
    onChunk: (chunk) => {
      const transfer = [chunk.positions.buffer, chunk.index.buffer];
      if (chunk.uvs) transfer.push(chunk.uvs.buffer);
      self.postMessage({ type: "CHUNK", chunk }, transfer);
    },
    onProgress: (progress) => {
      const now = performance.now();
      if (now - lastProgress < 100 && progress.done < progress.total) return;
      lastProgress = now;
      self.postMessage({ type: "PROGRESS", progress });
    },
  });
  self.postMessage({ type: "PARSED", result });
}

// Display texture of one atlas: power-of-two size (S3TC needs multiples of 4
// on every mip level; the uvs are normalized, so the stretch is harmless),
// full mip chain down to 1x1, each level BC1-encoded.
function handleEncodeTexture({ id, bitmap, maxSize }) {
  const width = floorPowerOfTwo(Math.min(bitmap.width, maxSize));
  const height = floorPowerOfTwo(Math.min(bitmap.height, maxSize));

  const mipmaps = [];
  let source = bitmap;
  let w = width;
  let h = height;
  for (;;) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // each level is drawn from the previous one (successive halvings)
    ctx.drawImage(source, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    mipmaps.push({ data: encodeBc1(rgba, w, h), width: w, height: h });
    if (w === 1 && h === 1) break;
    source = canvas;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  bitmap.close();

  self.postMessage(
    { type: "TEXTURE", id, width, height, mipmaps },
    mipmaps.map((mipmap) => mipmap.data.buffer)
  );
}

self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.type === "PARSE") await handleParse(message.file);
    else if (message.type === "ENCODE_TEXTURE") handleEncodeTexture(message);
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      id: message.id,
      code: error?.code ?? "SCENE_3D_IMPORT_FAILED",
      message: error?.message ?? String(error),
    });
  }
};
