import { Group } from "three";

import scanResources from "./scanResources";
import readLocalScanInWorker from "./readLocalScanInWorker";
import projectLocalScanInWorker from "./projectLocalScanInWorker";
import localScanRuntime from "./localScanRuntime";
import { buildLocalScanHeightMap } from "./localScanHeightMapService";
import applyLocalScanPlacement from "../utils/applyLocalScanPlacement";
import getLocalScanZoneFrame from "../utils/getLocalScanZoneFrame";
import getLocalScanMatrixInBaseMap from "../utils/getLocalScanMatrixInBaseMap";
import prepareScanBaseMap from "../utils/prepareScanBaseMap";
import sliceImageFile from "../utils/sliceImageFile";
import { getScanZonePlacement } from "../utils/localScanZone";
import { DEFAULT_LOCAL_SCAN_PLACEMENT } from "../constants/localScanPlacement";

// Longest side of the base map image (px); the Scan 3D tool re-renders
// the slice at its own resolution on « Mettre à jour ».
const BASE_MAP_RESOLUTION = 1024;

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
};

// Base map of a point cloud, from the « Scène 3D » import: the zone of
// interest chosen on the preview (DialogCreateBaseMapFromScene3d) is
// decoded, saved as a project resource (or re-zoned on the resource picked
// in Ressources), placed like the Scan 3D tool does (getScanZonePlacement:
// zone X axis = displayed X, zone centre at the scan floor = scene zero)
// and projected over its whole height in the preview mode (density or mean
// colours). The base map stores the scan pose (localScan.matrix) so the
// point cloud follows it in 3D, the same createdFrom as the tool, and its
// height map (altimetry under the cursor). → base map entity
// onProgress({step: "DECODE" | "PROJECT" | "CREATE", ratio})
export default async function createScanBaseMapFromZoneService({
  source,
  resource = null,
  zone,
  wholePolygon,
  mode,
  name,
  listing,
  projectId,
  axesYawDeg = 0,
  createBaseMapFromImage,
  onProgress,
  signal,
}) {
  onProgress?.({ step: "DECODE", ratio: 0 });
  const data = await readLocalScanInWorker(source, {
    signal,
    onProgress: (ratio) => onProgress?.({ step: "DECODE", ratio }),
    read: { zone },
  });
  throwIfAborted(signal);

  const placement = {
    ...DEFAULT_LOCAL_SCAN_PLACEMENT,
    // the scale of an already calibrated resource is kept
    ...(resource?.scan?.placement?.scale > 0 && {
      scale: resource.scan.placement.scale,
    }),
    ...getScanZonePlacement(zone, axesYawDeg, wholePolygon),
  };

  let saved = resource;
  if (saved) {
    await scanResources.update(saved.id, {
      zone,
      placement,
      count: data.count,
      bounds: data.bounds,
    });
  } else {
    saved = await scanResources.save({
      projectId,
      file: source,
      data,
      placement,
      zone,
      signal,
    });
  }
  throwIfAborted(signal);

  onProgress?.({ step: "PROJECT", ratio: 0 });
  const root = new Group();
  applyLocalScanPlacement(root, placement);
  const frame = getLocalScanZoneFrame(
    zone,
    wholePolygon,
    data.bounds,
    root.matrixWorld.elements,
    axesYawDeg
  );
  const result = await projectLocalScanInWorker(data, {
    frame,
    lower: frame.min[2],
    upper: frame.max[2],
    resolution: BASE_MAP_RESOLUTION,
  });
  if (!result?.pointCount) throw new Error("La zone ne contient aucun point.");
  throwIfAborted(signal);
  const file = await sliceImageFile(result, mode, `${name}.png`);
  const pose = prepareScanBaseMap(result, frame, 0);

  onProgress?.({ step: "CREATE", ratio: 0 });
  const entity = await createBaseMapFromImage({
    file,
    name,
    listing,
    meterByPx: result.pixelSize,
    ...pose,
    localScan: {
      resourceId: saved.id,
      matrix: getLocalScanMatrixInBaseMap(root.matrixWorld, pose),
    },
    source: "local-scan",
    // PLY files stay device-local: no initial remote save
    triggerInitialSave: false,
    createdFrom: {
      type: "LOCAL_SCAN",
      resourceId: saved.id,
      mode,
      altitude: 0,
      lower: result.lower,
      upper: result.upper,
      frame: { min: frame.min, max: frame.max, rows: frame.rows },
    },
  });
  if (!entity?.id) throw new Error("Le fond de plan n’a pas pu être créé.");

  // The decoded points join the shared runtime: the 3D attaches the cloud
  // to the new base map without decoding the file again.
  const handle = localScanRuntime.seed(
    { id: saved.id, scan: { zone } },
    { data, source }
  );
  try {
    await buildLocalScanHeightMap({
      baseMapId: entity.id,
      projectId,
      data,
      rootMatrixWorld: root.matrixWorld,
      baseMap: {
        ...pose,
        refWidth: result.width,
        refHeight: result.height,
        meterByPx: result.pixelSize,
      },
    });
  } catch (error) {
    // rebuilt later from the resource (ensureLocalScanHeightMap)
    console.warn("[localScans] height map not built at creation", error);
  } finally {
    handle.release();
  }
  return entity;
}
