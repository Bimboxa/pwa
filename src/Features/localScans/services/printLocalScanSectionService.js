import projectLocalScanInWorker from "./projectLocalScanInWorker";
import getLocalScanSectionFrame from "../utils/getLocalScanSectionFrame";
import sliceImageFile from "../utils/sliceImageFile";

// "Print" of the point clouds cut by a section page: every point within
// `toleranceM` of the page plane lands on the page raster (average colour
// per pixel, white elsewhere) — the slice projection of the Scan 3D tool
// (projectLocalScanSlice), with the distance to the page as slice axis.
//
// clouds: [{data: {positions, colors}, matrixWorld: Matrix4}] (the scan
// views displayed in the 3D scene); page: {position, angleDeg, orientation,
// width, height (px), meterByPx}. `range` ({lower, upper}, signed distances
// to the page plane) replaces the symmetric tolerance: a layer in front of
// or behind the page.
// → {file (PNG), pointCount}, or null when no point falls in the slab.
export default async function printLocalScanSectionService({
  clouds,
  page,
  toleranceM,
  range = null,
  name = "coupe",
}) {
  const lower = range ? range.lower : -toleranceM;
  const upper = range ? range.upper : toleranceM;
  if (!clouds?.length || !(lower <= upper) || (!range && !(toleranceM > 0)))
    return null;
  let merged = null;
  // One cloud at a time: each job clones its positions into a worker.
  for (const cloud of clouds) {
    const result = await projectLocalScanInWorker(cloud.data, {
      frame: getLocalScanSectionFrame(cloud.matrixWorld, page),
      lower,
      upper,
    });
    if (!result?.pointCount) continue;
    if (!merged) {
      merged = result;
      continue;
    }
    // Several clouds on one page: a printed pixel is never erased by the
    // white of another cloud.
    const { rgb } = merged;
    for (let i = 0; i < rgb.length; i += 4) {
      if (rgb[i] !== 255 || rgb[i + 1] !== 255 || rgb[i + 2] !== 255) continue;
      rgb[i] = result.rgb[i];
      rgb[i + 1] = result.rgb[i + 1];
      rgb[i + 2] = result.rgb[i + 2];
    }
    merged.pointCount += result.pointCount;
  }
  if (!merged) return null;
  return {
    file: await sliceImageFile(merged, "rgb", `${name}.png`),
    pointCount: merged.pointCount,
  };
}
