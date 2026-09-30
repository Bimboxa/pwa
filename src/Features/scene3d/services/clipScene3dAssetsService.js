import db from "App/db/db";

import createScene3dImportWorker from "./createScene3dImportWorker";
import {
  getScene3dHeightId,
  getScene3dTextureId,
  parseScene3dAssetId,
} from "../utils/scene3dAssetIds";

// Clips the stored scan to the zone of interest (see clipScene3dChunk):
// every GEOMETRY row is read once, clipped in the worker and written back
// (or deleted when nothing of it lies in the zone); the HEIGHT row is
// replaced by the height map of the clipped scan; the TEXTURE row of an
// atlas left without geometry is deleted. Memory stays bounded: one chunk
// in flight at a time.
//
// bbox: the quantization bbox of the scan (descriptor.bbox, unchanged by the
// clip); polygon: [[x, y], …] in the scan frame.
// onProgress(ratio)
// → {zMin, zMax, vertexCount, faceCount, geometryBytes, removedTextureBytes}
export default async function clipScene3dAssetsService({
  sceneId,
  projectId,
  bbox,
  polygon,
  onProgress,
}) {
  const keys = await db.scene3dAssets
    .where("sceneId")
    .equals(sceneId)
    .primaryKeys();
  const geometryKeys = keys
    .filter((key) => parseScene3dAssetId(key)?.kind === "GEOMETRY")
    .sort();
  const atlasesWithGeometry = new Set();
  // row metadata kept aside: the buffers of a row are transferred to the
  // worker, the clipped ones come back with the reply
  const metaByKey = new Map();
  let geometryBytes = 0;
  let done = 0;

  async function* readRows() {
    for (const key of geometryKeys) {
      const row = await db.scene3dAssets.get(key);
      if (!row) continue;
      const { positions, uvs, index, ...meta } = row;
      metaByKey.set(key, meta);
      yield { key, row: { positions, uvs, index } };
    }
  }

  const worker = createScene3dImportWorker();
  try {
    const result = await worker.clipGeometry(
      bbox,
      polygon,
      readRows(),
      async (key, clipped) => {
        if (clipped) {
          atlasesWithGeometry.add(parseScene3dAssetId(key).atlasIndex);
          geometryBytes +=
            clipped.positions.byteLength +
            (clipped.uvs?.byteLength ?? 0) +
            clipped.index.byteLength;
          await db.scene3dAssets.put({ ...metaByKey.get(key), ...clipped });
        } else {
          await db.scene3dAssets.delete(key);
        }
        done += 1;
        onProgress?.(done / Math.max(1, geometryKeys.length));
      }
    );

    const { heightMap } = result;
    await db.scene3dAssets.put({
      id: getScene3dHeightId(sceneId),
      sceneId,
      projectId,
      kind: "HEIGHT",
      cols: heightMap.cols,
      rows: heightMap.rows,
      cellSize: heightMap.cellSize,
      bbox: heightMap.bbox,
      data: heightMap.data,
    });

    // textures of the atlases that lost all their geometry
    let removedTextureBytes = 0;
    const textureKeys = keys.filter(
      (key) => parseScene3dAssetId(key)?.kind === "TEXTURE"
    );
    for (const key of textureKeys) {
      const { atlasIndex } = parseScene3dAssetId(key);
      if (atlasesWithGeometry.has(atlasIndex)) continue;
      const row = await db.scene3dAssets.get(
        getScene3dTextureId(sceneId, atlasIndex)
      );
      removedTextureBytes +=
        row?.mipmaps?.reduce((sum, m) => sum + m.data.byteLength, 0) ?? 0;
      await db.scene3dAssets.delete(key);
    }

    return {
      zMin: result.zMin,
      zMax: result.zMax,
      vertexCount: result.vertexCount,
      faceCount: result.triangleCount,
      geometryBytes: geometryBytes + heightMap.data.byteLength,
      removedTextureBytes,
    };
  } finally {
    worker.terminate();
  }
}
