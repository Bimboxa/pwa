import db from "App/db/db";
import { prepareVersionImageReplacement } from "Features/baseMaps/services/replaceVersionImageService";
import projectLocalScanInWorker from "./projectLocalScanInWorker";
import prepareScanBaseMap from "../utils/prepareScanBaseMap";
import sliceImageFile from "../utils/sliceImageFile";
import getLocalScanBaseMapFrame from "../utils/getLocalScanBaseMapFrame";
import getLocalScanMatrixInBaseMap from "../utils/getLocalScanMatrixInBaseMap";
import {
  buildLocalScanHeightMap,
  DEFAULT_HEIGHT_MAP_OPTIONS,
} from "./localScanHeightMapService";

// « Mettre à jour le fond de plan »: the image of a scan base map is
// replaced by the current slice of the Scan 3D tool (Z range, scan pose
// after a new horizontal alignment).
//   - no annotation on the base map: re-framed like at creation (new raster,
//     scale, centre and angle; the altitude is kept);
//   - annotations: the slice is re-rendered in the EXISTING raster (same
//     size, scale and pose), so every annotation stays where it was; what
//     falls outside the image is cropped.
// The active version image is replaced in place, localScan.matrix follows
// the scan pose and the height map (altimetry under the cursor) is rebuilt.
// → {reframed}
export default async function updateScanBaseMapService({
  baseMapId,
  view,
  projection,
  // {result, frame}: the slice re-cut to the preview framing (re-framed
  // update); the projection's own raster otherwise.
  framed = null,
  // {includeBelow, includeAbove}: points of the height map outside the
  // slice (stored in createdFrom.heightMap for the rebuilds).
  heightMapOptions = DEFAULT_HEIGHT_MAP_OPTIONS,
}) {
  const baseMap = await db.baseMaps.get(baseMapId);
  if (!baseMap?.localScan)
    throw new Error("Ce fond de plan n’est pas un scan.");
  const { mode } = projection;
  const { result, frame } = framed ?? projection;
  const { lower, upper } = result;
  view.root.updateMatrixWorld(true);
  const root = view.root.matrixWorld;

  const annotationsCount = await db.annotations
    .where("baseMapId")
    .equals(baseMapId)
    .filter((annotation) => !annotation.deletedAt)
    .count();
  const keepFrame =
    annotationsCount > 0 &&
    baseMap.meterByPx > 0 &&
    baseMap.refWidth > 0 &&
    baseMap.refHeight > 0;

  let raster, patch;
  if (keepFrame) {
    raster = await projectLocalScanInWorker(view.data, {
      frame: getLocalScanBaseMapFrame(root, baseMap),
      lower,
      upper,
    });
    patch = {
      localScan: {
        ...baseMap.localScan,
        matrix: getLocalScanMatrixInBaseMap(root, baseMap),
      },
    };
  } else {
    raster = result;
    const placement = prepareScanBaseMap(
      result,
      frame,
      baseMap.position?.y ?? 0
    );
    patch = {
      ...placement,
      meterByPx: result.pixelSize,
      refWidth: result.width,
      refHeight: result.height,
      localScan: {
        ...baseMap.localScan,
        matrix: getLocalScanMatrixInBaseMap(root, placement),
      },
    };
  }

  const file = await sliceImageFile(raster, mode);
  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  ).filter((version) => !version.deletedAt);
  const active = versions.find((version) => version.isActive) ?? versions[0];
  const { fileRecord, image } = await prepareVersionImageReplacement({
    baseMapId,
    record: baseMap,
    file,
    imageSize: { width: raster.width, height: raster.height },
  });

  await db.transaction(
    "rw",
    db.files,
    db.baseMapVersions,
    db.baseMaps,
    async () => {
      await db.files.put(fileRecord);
      if (active) await db.baseMapVersions.update(active.id, { image });
      await db.baseMaps.update(baseMapId, {
        ...patch,
        image,
        createdFrom: {
          ...baseMap.createdFrom,
          mode,
          lower,
          upper,
          frame: { min: frame.min, max: frame.max, rows: frame.rows },
          heightMap: { ...heightMapOptions },
        },
      });
    }
  );
  try {
    await buildLocalScanHeightMap({
      baseMapId,
      projectId: baseMap.projectId,
      data: view.data,
      rootMatrixWorld: root,
      baseMap: {
        ...baseMap,
        ...patch,
        createdFrom: { ...baseMap.createdFrom, lower, upper },
      },
      options: heightMapOptions,
    });
  } catch (error) {
    // rebuilt later from the resource (ensureLocalScanHeightMap)
    console.warn("[localScans] height map not rebuilt", error);
  }
  return { reframed: !keepFrame };
}
