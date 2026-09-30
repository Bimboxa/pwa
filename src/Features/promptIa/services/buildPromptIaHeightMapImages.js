import { loadScene3dHeightMap } from "Features/scene3d/services/scene3dHeightMapStore";
import getScene3dHeightAtPx from "Features/scene3d/utils/getScene3dHeightAtPx";

import { buildHeightMapImageData } from "../utils/heightMapRg16";

function canvasToPngBlob(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}

/**
 * Height map of a scan base map (« Scène 3D ») rendered IN THE PIXEL FRAME OF
 * `plan.png`: pixel (i, j) of `hauteurs.png` is pixel (i, j) of `plan.png`,
 * so the normalized coordinates of the detection apply to both pictures.
 *
 * Heights are metres above the base map plane (the frame of `offsetZ`),
 * encoded RG16 (see utils/heightMapRg16), plus an 8-bit grey preview for
 * vision-only reading.
 *
 * @param {Object} p
 * @param {Object} p.baseMap - BaseMap instance carrying `scene3d`
 * @param {{width:number,height:number}} p.image - size of plan.png
 * @param {string} [p.projectId]
 * @returns {Promise<{blob: Blob, previewBlob: Blob, width: number,
 *   height: number, zMax: number, coverage: number, cellSizeM: number} |
 *   {reason: string}>}
 */
export default async function buildPromptIaHeightMapImages({
  baseMap,
  image,
  projectId,
}) {
  const scene3d = baseMap?.scene3d;
  if (!scene3d?.sceneId) return { reason: "Le fond n'est pas un scan." };
  const ref = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  const meterByPx = baseMap.getMeterByPx?.() ?? baseMap.meterByPx ?? null;
  if (!ref?.width || !ref?.height || !(meterByPx > 0))
    return { reason: "Fond non calibré." };

  const heightMap = await loadScene3dHeightMap(scene3d.sceneId, {
    bbox: scene3d.bbox,
    projectId,
  });
  if (!heightMap)
    return {
      reason:
        "Relief indisponible sur cet appareil (données du scan absentes : « Recharger les fichiers » dans les propriétés du fond).",
    };

  const { width, height } = image;
  const frame = { scene3d, imageSize: ref, meterByPx };
  const kx = ref.width / width;
  const ky = ref.height / height;
  const sampleAt = (px, py) =>
    getScene3dHeightAtPx(frame, { x: px * kx, y: py * ky }, heightMap);

  const { rgba, preview, stats } = buildHeightMapImageData({
    width,
    height,
    sampleAt,
  });
  if (!(stats.coverage > 0))
    return { reason: "Le relief du scan ne couvre pas le fond." };

  const [blob, previewBlob] = await Promise.all([
    canvasToPngBlob(rgba, width, height),
    canvasToPngBlob(preview, width, height),
  ]);
  return {
    blob,
    previewBlob,
    width,
    height,
    zMax: stats.zMax,
    coverage: stats.coverage,
    cellSizeM: Math.round(heightMap.cellSize * 1000) / 1000,
  };
}
