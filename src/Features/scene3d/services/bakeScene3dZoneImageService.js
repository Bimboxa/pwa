import db from "App/db/db";

import createScene3dTopViewBaker from "./createScene3dTopViewBaker";
import matchScene3dFiles from "../utils/matchScene3dFiles";
import decodeAtlasBitmap from "../utils/decodeAtlasBitmap";
import { getScene3dGeometryIdRange } from "../utils/scene3dAssetIds";
import { SCENE_3D_TOP_VIEW_SIZES } from "../constants/scene3dConstants";

// Bakes the image of a scan base map: the top-down projection of the
// (clipped) scan, framed on the zone of interest and rotated by its angle
// (see createScene3dTopViewBaker). Atlas by atlas, from the original
// texture files still at hand in the creation dialog.
//
// onProgress(ratio)
// → {blob, fileMime, width, height, pxPerMeter}
export default async function bakeScene3dZoneImageService({
  sceneId,
  bbox,
  zone,
  atlases,
  textureNames,
  imageFiles,
  topViewSizeKey = "STANDARD",
  onProgress,
  signal,
}) {
  const size =
    SCENE_3D_TOP_VIEW_SIZES[topViewSizeKey] ?? SCENE_3D_TOP_VIEW_SIZES.STANDARD;
  const { textureFiles } = matchScene3dFiles(textureNames, imageFiles);
  const baker = createScene3dTopViewBaker({ bbox, maxPx: size.maxPx, zone });
  try {
    for (let i = 0; i < atlases.length; i++) {
      if (signal?.aborted) throw new Error("Bake cancelled.");
      const { atlasIndex } = atlases[i];
      const [lower, upper] = getScene3dGeometryIdRange(sceneId, atlasIndex);
      const rows = await db.scene3dAssets
        .where("id")
        .between(lower, upper)
        .toArray();
      if (rows.length === 0) continue;
      const file = textureFiles[atlasIndex] ?? null;
      const bitmap = file
        ? await decodeAtlasBitmap(file, size.textureMaxSize)
        : null;
      baker.renderAtlas(rows, bitmap);
      bitmap?.close();
      onProgress?.((i + 1) / atlases.length);
    }
    const { blob, fileMime } = await baker.toBlob();
    return {
      blob,
      fileMime,
      width: baker.width,
      height: baker.height,
      pxPerMeter: baker.pxPerMeter,
    };
  } finally {
    baker.dispose();
  }
}
