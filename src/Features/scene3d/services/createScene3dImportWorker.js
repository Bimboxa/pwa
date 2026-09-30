// Main-thread handle on the SCENE_3D import worker (one worker per import,
// terminated when the import ends or is cancelled).

function toError(message) {
  const error = new Error(message.message);
  error.code = message.code;
  return error;
}

export default function createScene3dImportWorker() {
  const worker = new Worker(
    new URL("../workers/scene3dImport.worker.js", import.meta.url),
    { type: "module" }
  );

  let parseJob = null;
  let nextTextureId = 0;
  const textureJobs = new Map();
  let nextHeightMapId = 0;
  const heightMapJobs = new Map();

  worker.onmessage = (event) => {
    const message = event.data;
    if (message.type === "CHUNK") parseJob?.onChunk?.(message.chunk);
    else if (message.type === "PROGRESS")
      parseJob?.onProgress?.(message.progress);
    else if (message.type === "PARSED") {
      parseJob?.resolve(message.result);
      parseJob = null;
    } else if (message.type === "TEXTURE") {
      textureJobs.get(message.id)?.resolve(message);
      textureJobs.delete(message.id);
    } else if (message.type === "HEIGHT_MAP") {
      heightMapJobs.get(message.id)?.resolve(message.heightMap);
      heightMapJobs.delete(message.id);
    } else if (message.type === "ERROR") {
      if (message.id != null && textureJobs.has(message.id)) {
        textureJobs.get(message.id).reject(toError(message));
        textureJobs.delete(message.id);
      } else if (message.id != null && heightMapJobs.has(message.id)) {
        heightMapJobs.get(message.id).reject(toError(message));
        heightMapJobs.delete(message.id);
      } else {
        parseJob?.reject(toError(message));
        parseJob = null;
      }
    }
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "Scene import worker crashed.");
    parseJob?.reject(error);
    parseJob = null;
    textureJobs.forEach((job) => job.reject(error));
    textureJobs.clear();
    heightMapJobs.forEach((job) => job.reject(error));
    heightMapJobs.clear();
  };

  return {
    // → parse result (see parseScenePly) + `heightMap` (see
    //   rasterizeScene3dHeightMap); chunks arrive through onChunk.
    parse(file, { onChunk, onProgress } = {}) {
      return new Promise((resolve, reject) => {
        parseJob = { resolve, reject, onChunk, onProgress };
        worker.postMessage({ type: "PARSE", file });
      });
    },
    // The bitmap is transferred (unusable afterwards).
    // → {width, height, mipmaps: [{data, width, height}]}
    encodeTexture(bitmap, maxSize) {
      return new Promise((resolve, reject) => {
        const id = nextTextureId++;
        textureJobs.set(id, { resolve, reject });
        worker.postMessage({ type: "ENCODE_TEXTURE", id, bitmap, maxSize }, [
          bitmap,
        ]);
      });
    },
    // Rebuilds the height map of a scan from its stored GEOMETRY rows (an
    // async iterable — read one by one, the buffers are transferred).
    // → heightMap (see rasterizeScene3dHeightMap)
    async buildHeightMap(bbox, rows) {
      const id = nextHeightMapId++;
      worker.postMessage({ type: "HEIGHT_MAP_INIT", id, bbox });
      for await (const row of rows) {
        const chunk = { positions: row.positions, index: row.index };
        worker.postMessage({ type: "HEIGHT_MAP_CHUNK", id, chunk }, [
          chunk.positions.buffer,
          chunk.index.buffer,
        ]);
      }
      return new Promise((resolve, reject) => {
        heightMapJobs.set(id, { resolve, reject });
        worker.postMessage({ type: "HEIGHT_MAP_FINISH", id });
      });
    },
    terminate() {
      worker.terminate();
    },
  };
}
