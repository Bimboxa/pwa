import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import createScene3dImportWorker from "./createScene3dImportWorker";
import createScene3dTopViewBaker from "./createScene3dTopViewBaker";
import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import {
  markScene3dImporting,
  unmarkScene3dImporting,
} from "./scene3dPendingStore";
import matchScene3dFiles from "../utils/matchScene3dFiles";
import {
  getScene3dGeometryId,
  getScene3dGeometryIdRange,
  getScene3dHeightId,
  getScene3dTextureId,
} from "../utils/scene3dAssetIds";
import {
  SCENE_3D_DISPLAY_TEXTURE_MAX_SIZE,
  SCENE_3D_TOP_VIEW_SIZES,
} from "../constants/scene3dConstants";

function createAbortError() {
  const error = new Error("Scene import cancelled.");
  error.code = "SCENE_3D_IMPORT_CANCELLED";
  return error;
}

// Decodes one atlas at the size the bake needs (never the full 8192² on the
// GPU). The full-size decode is transient and closed right away; atlases are
// processed one at a time.
async function decodeAtlasBitmap(file, maxSize) {
  const full = await createImageBitmap(file, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const scale = Math.min(1, maxSize / Math.max(full.width, full.height));
  if (scale === 1) return full;
  try {
    return await createImageBitmap(full, {
      resizeWidth: Math.max(1, Math.round(full.width * scale)),
      resizeHeight: Math.max(1, Math.round(full.height * scale)),
      resizeQuality: "high",
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
  } finally {
    full.close();
  }
}

// Converts a scan (PLY mesh + texture atlases) into the local, GPU-ready
// form of a SCENE_3D annotation, in a streaming way (see
// docs/annotations/SCENE_3D_ANNOTATIONS.md):
//   1. worker: PLY → geometry chunks, written to db.scene3dAssets as they
//      arrive (the mesh is never held whole in memory) + the height map of
//      the scan (HEIGHT row, rasterized chunk by chunk in the worker);
//   2. atlas by atlas: decode the image → draw its chunks in the top view →
//      BC1 mip chain (worker) → TEXTURE row;
//   3. the top view is returned as a Blob (persisted by the caller with the
//      annotation: it is the only part that travels in the Krto zip).
// Nothing references the rows until the annotation is created: a cancelled
// or failed import deletes them. On success the scan stays marked as
// "importing" (orphan-purge protection): the caller unmarks it once the scan
// is handed over (unmarkScene3dImporting).
//
// onProgress({step: "MESH" | "TEXTURES" | "TOP_VIEW", ratio})
// → {descriptor (annotation.scene3d, without topView), topView: {blob,
//    fileMime, width, height, pxPerMeter}, missingTextureNames}
export default async function importScene3dFilesService({
  plyFile,
  imageFiles,
  projectId,
  topViewSizeKey = "STANDARD",
  onProgress,
  signal,
}) {
  const sceneId = nanoid();
  // Protected from the orphan purge until the caller hands the scan over
  // (pending placement or annotation reload) and unmarks it.
  markScene3dImporting(sceneId);
  const worker = createScene3dImportWorker();
  let baker = null;
  let storedBytes = 0;

  const throwIfAborted = () => {
    if (signal?.aborted) throw createAbortError();
  };
  const onAbort = () => worker.terminate();
  signal?.addEventListener("abort", onAbort);

  try {
    // 1. mesh → chunk rows
    let writeQueue = Promise.resolve();
    let writeError = null;
    const parsePromise = worker.parse(plyFile, {
      onChunk: (chunk) => {
        const row = {
          id: getScene3dGeometryId(sceneId, chunk.atlasIndex, chunk.chunkIndex),
          sceneId,
          projectId,
          kind: "GEOMETRY",
          ...chunk,
        };
        storedBytes +=
          chunk.positions.byteLength +
          (chunk.uvs?.byteLength ?? 0) +
          chunk.index.byteLength;
        writeQueue = writeQueue
          .then(() => db.scene3dAssets.put(row))
          .catch((error) => {
            writeError = writeError ?? error;
          });
      },
      onProgress: (progress) => {
        if (progress.phase !== "FACES") return;
        onProgress?.({ step: "MESH", ratio: progress.done / progress.total });
      },
    });
    const parsed = await Promise.race([
      parsePromise,
      new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(createAbortError()))
      ),
    ]);
    await writeQueue;
    if (writeError) throw writeError;
    throwIfAborted();

    // 1b. height map (2D altimetry under the cursor), rasterized by the
    // worker while the chunks went by
    if (parsed.heightMap) {
      const { cols, rows, cellSize, bbox, data } = parsed.heightMap;
      storedBytes += data.byteLength;
      await db.scene3dAssets.put({
        id: getScene3dHeightId(sceneId),
        sceneId,
        projectId,
        kind: "HEIGHT",
        cols,
        rows,
        cellSize,
        bbox,
        data,
      });
    }

    // 2. atlases: top view + display textures
    const { textureFiles, missingNames } = matchScene3dFiles(
      parsed.textureNames,
      imageFiles
    );
    const topViewSize =
      SCENE_3D_TOP_VIEW_SIZES[topViewSizeKey] ??
      SCENE_3D_TOP_VIEW_SIZES.STANDARD;
    baker = createScene3dTopViewBaker({
      bbox: parsed.bbox,
      maxPx: topViewSize.maxPx,
    });

    for (let i = 0; i < parsed.atlases.length; i++) {
      throwIfAborted();
      const { atlasIndex } = parsed.atlases[i];
      const file = textureFiles[atlasIndex] ?? null;
      const bitmap = file
        ? await decodeAtlasBitmap(file, topViewSize.textureMaxSize)
        : null;

      const [lower, upper] = getScene3dGeometryIdRange(sceneId, atlasIndex);
      const rows = await db.scene3dAssets
        .where("id")
        .between(lower, upper)
        .toArray();
      baker.renderAtlas(rows, bitmap);

      if (bitmap) {
        const texture = await worker.encodeTexture(
          bitmap,
          SCENE_3D_DISPLAY_TEXTURE_MAX_SIZE
        );
        storedBytes += texture.mipmaps.reduce(
          (sum, mipmap) => sum + mipmap.data.byteLength,
          0
        );
        await db.scene3dAssets.put({
          id: getScene3dTextureId(sceneId, atlasIndex),
          sceneId,
          projectId,
          kind: "TEXTURE",
          atlasIndex,
          format: "BC1",
          width: texture.width,
          height: texture.height,
          mipmaps: texture.mipmaps,
        });
      }
      onProgress?.({
        step: "TEXTURES",
        ratio: (i + 1) / parsed.atlases.length,
      });
    }
    throwIfAborted();

    // 3. top view
    onProgress?.({ step: "TOP_VIEW", ratio: 0 });
    const { blob, fileMime } = await baker.toBlob();
    onProgress?.({ step: "TOP_VIEW", ratio: 1 });

    return {
      descriptor: {
        sceneId,
        srcFileName: plyFile.name,
        bbox: parsed.bbox,
        origin: parsed.origin,
        vertexCount: parsed.vertexCount,
        faceCount: parsed.triangleCount,
        atlasCount: parsed.atlases.length,
        storedBytes,
      },
      topView: {
        blob,
        fileMime,
        width: baker.width,
        height: baker.height,
        pxPerMeter: baker.pxPerMeter,
      },
      missingTextureNames: missingNames,
    };
  } catch (error) {
    await deleteScene3dAssetsService(sceneId).catch(() => {});
    unmarkScene3dImporting(sceneId);
    throw signal?.aborted ? createAbortError() : error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    baker?.dispose();
    worker.terminate();
  }
}
