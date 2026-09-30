import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import createScene3dImportWorker from "./createScene3dImportWorker";
import createScene3dTopViewBaker from "./createScene3dTopViewBaker";
import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import {
  markScene3dImporting,
  unmarkScene3dImporting,
} from "./scene3dImportingGuard";
import matchScene3dFiles from "../utils/matchScene3dFiles";
import decodeAtlasBitmap from "../utils/decodeAtlasBitmap";
import {
  getScene3dGeometryId,
  getScene3dGeometryIdRange,
  getScene3dHeightId,
  getScene3dTextureId,
} from "../utils/scene3dAssetIds";
import {
  SCENE_3D_DISPLAY_TEXTURE_MAX_SIZE,
  SCENE_3D_PREVIEW_MAX_PX,
  SCENE_3D_TOP_VIEW_SIZES,
} from "../constants/scene3dConstants";

export function createScene3dAbortError() {
  const error = new Error("Scene import cancelled.");
  error.code = "SCENE_3D_IMPORT_CANCELLED";
  return error;
}

// Converts a scan (PLY mesh + texture atlases) into the local, GPU-ready
// form of a scan base map, in a streaming way (see
// docs/baseMaps/SCENE_3D_BASE_MAPS.md):
//   1. worker: PLY → geometry chunks, written to db.scene3dAssets as they
//      arrive (the mesh is never held whole in memory) + the height map of
//      the scan (HEIGHT row, rasterized chunk by chunk in the worker);
//   2. atlas by atlas: decode the image → draw its chunks in the whole-scan
//      preview → BC1 mip chain (worker) → TEXTURE row;
//   3. the preview is returned as a Blob: it is the picture the zone of
//      interest is drawn on (never persisted — the base map image is baked
//      afterwards from the clipped scan, bakeScene3dZoneImageService).
// Nothing references the rows until the base map is created: a cancelled
// or failed import deletes them. On success the scan stays marked as
// "importing" (orphan-purge protection): the caller unmarks it once the scan
// is handed over (unmarkScene3dImporting).
//
// onProgress({step: "MESH" | "TEXTURES" | "TOP_VIEW", ratio})
// → {descriptor: {sceneId, srcFileName, bbox, origin, vertexCount, faceCount,
//    atlasCount, textureBytes}, atlases, textureNames, preview: {blob,
//    fileMime, width, height, pxPerMeter}, missingTextureNames}
export default async function importScene3dFilesService({
  plyFile,
  imageFiles,
  projectId,
  onProgress,
  signal,
}) {
  const sceneId = nanoid();
  // Protected from the orphan purge until the caller hands the scan over
  // (base map created or reloaded) and unmarks it.
  markScene3dImporting(sceneId);
  const worker = createScene3dImportWorker();
  let baker = null;
  let textureBytes = 0;

  const throwIfAborted = () => {
    if (signal?.aborted) throw createScene3dAbortError();
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
        signal?.addEventListener("abort", () =>
          reject(createScene3dAbortError())
        )
      ),
    ]);
    await writeQueue;
    if (writeError) throw writeError;
    throwIfAborted();

    // 1b. height map (2D altimetry under the cursor), rasterized by the
    // worker while the chunks went by — replaced by the clipped one when the
    // zone is validated
    if (parsed.heightMap) {
      const { cols, rows, cellSize, bbox, data } = parsed.heightMap;
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

    // 2. atlases: preview + display textures
    const { textureFiles, missingNames } = matchScene3dFiles(
      parsed.textureNames,
      imageFiles
    );
    baker = createScene3dTopViewBaker({
      bbox: parsed.bbox,
      maxPx: SCENE_3D_PREVIEW_MAX_PX,
    });

    for (let i = 0; i < parsed.atlases.length; i++) {
      throwIfAborted();
      const { atlasIndex } = parsed.atlases[i];
      const file = textureFiles[atlasIndex] ?? null;
      const bitmap = file
        ? await decodeAtlasBitmap(
            file,
            SCENE_3D_TOP_VIEW_SIZES.STANDARD.textureMaxSize
          )
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
        textureBytes += texture.mipmaps.reduce(
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

    // 3. preview
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
        textureBytes,
      },
      atlases: parsed.atlases,
      textureNames: parsed.textureNames,
      preview: {
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
    throw signal?.aborted ? createScene3dAbortError() : error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    baker?.dispose();
    worker.terminate();
  }
}
