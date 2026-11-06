import { nanoid } from "@reduxjs/toolkit";

import bakeScene3dGlbImageService from "./bakeScene3dGlbImageService";
import parseScene3dGlb, { disposeScene3dGlbModel } from "../js/parseScene3dGlb";
import { SCENE_3D_PREVIEW_MAX_PX } from "../constants/scene3dConstants";

function throwIfCancelled(signal, model) {
  if (!signal?.aborted) return;
  if (model) disposeScene3dGlbModel(model);
  const error = new Error("Import cancelled.");
  error.code = "SCENE_3D_IMPORT_CANCELLED";
  throw error;
}

// Import of a GLB for a scan base map (« Scène 3D »): the file is parsed in
// memory (nothing is written — the model is kept as is, see
// scene3dConstants SCENE_3D_FORMAT) and its whole top view is rendered for
// the zone editor.
//
// onProgress({step: "MESH" | "TOP_VIEW", ratio})
// → {descriptor: {sceneId, srcFileName, bbox, vertexCount, faceCount,
//      fileBytes}, model (parseScene3dGlb — owned by the caller: seed the
//      cache with it or dispose it), preview: {blob, width, height,
//      pxPerMeter}}
export default async function importScene3dGlbService({
  file,
  onProgress,
  signal,
}) {
  onProgress?.({ step: "MESH", ratio: 0 });
  const buffer = await file.arrayBuffer();
  throwIfCancelled(signal);
  onProgress?.({ step: "MESH", ratio: 0.3 });
  const model = await parseScene3dGlb(buffer);
  throwIfCancelled(signal, model);

  onProgress?.({ step: "TOP_VIEW", ratio: 0 });
  let preview;
  try {
    preview = await bakeScene3dGlbImageService({
      model,
      maxPx: SCENE_3D_PREVIEW_MAX_PX,
    });
  } catch (error) {
    disposeScene3dGlbModel(model);
    throw error;
  }
  throwIfCancelled(signal, model);

  return {
    descriptor: {
      sceneId: nanoid(),
      srcFileName: file.name,
      bbox: model.bbox,
      vertexCount: model.vertexCount,
      faceCount: model.faceCount,
      fileBytes: file.size,
    },
    model,
    preview: {
      blob: preview.blob,
      width: preview.width,
      height: preview.height,
      pxPerMeter: preview.pxPerMeter,
    },
  };
}
