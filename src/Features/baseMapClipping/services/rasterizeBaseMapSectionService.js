import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import printLocalScanSectionService from "Features/localScans/services/printLocalScanSectionService";

import collectSectionCloudsService from "./collectSectionCloudsService";

// « Rasteriser » of a base map: the point clouds are cut to a layer of the
// base map (`range`: signed distances to its plane — the layer of its
// clipping box seen from the camera, getVisibleClipLayerRange) and printed
// on its raster (average colour per pixel, white elsewhere —
// printLocalScanSectionService). The image becomes a NEW version of the base
// map, made the active one: the previous images stay in its versions and the
// annotations keep their place (same raster, same scale).
//
// baseMap: BaseMap instance (image size, scale, pose).
// createBaseMapVersionFn: useCreateBaseMapVersion.
// Returns { status, pointCount }, status:
//   "OK" | "NO_SCALE" | "NO_CLOUD" | "NO_POINT".
export default async function rasterizeBaseMapSectionService({
  baseMap,
  range,
  label,
  createBaseMapVersionFn,
}) {
  const result = { status: "OK", pointCount: 0 };
  const { width, height } = baseMap.getImageSize?.() ?? {};
  const meterByPx = baseMap.getMeterByPx?.();
  if (!(width > 0) || !(height > 0) || !(meterByPx > 0)) {
    return { ...result, status: "NO_SCALE" };
  }
  const page = { ...getBaseMapTransform(baseMap), width, height, meterByPx };

  const { clouds, release } = await collectSectionCloudsService(
    baseMap.projectId
  );
  let printed;
  try {
    if (!clouds.length) return { ...result, status: "NO_CLOUD" };
    printed = await printLocalScanSectionService({
      clouds,
      page,
      range,
      name: baseMap.name || "coupe",
    });
  } finally {
    release();
  }
  if (!printed?.pointCount) return { ...result, status: "NO_POINT" };

  await createBaseMapVersionFn(baseMap.id, printed.file, { label });
  result.pointCount = printed.pointCount;
  return result;
}
