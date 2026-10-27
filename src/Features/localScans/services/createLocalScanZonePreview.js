import readLocalScanInWorker from "./readLocalScanInWorker";
import projectLocalScanSlice from "../utils/projectLocalScanSlice";
import getUsefulScanHeight from "../utils/getUsefulScanHeight";
import sliceImageFile from "../utils/sliceImageFile";
import { getScanPreviewFrame } from "../utils/localScanZone";
import { getSliceDomain } from "../utils/slicePreviewGeometry";

// A regular sample is enough to draw the zone: the full decode only runs
// once the zone is chosen, and then keeps the zone only.
const PREVIEW_MAX_POINTS = 2_000_000;

export function readLocalScanSample(file, { signal, onProgress } = {}) {
  return readLocalScanInWorker(file, {
    signal,
    onProgress,
    read: { maxPoints: PREVIEW_MAX_POINTS },
  });
}

// Top-down density of the sample for one vertical axis. The caller revokes
// `url`. → {url, size, pxPerMeter, bbox, extent, useful}
//   extent  full vertical range of the sample (slider bounds)
//   useful  1st–99th percentile range, padded (default zone heights)
export async function buildLocalScanZonePreview(sample, up) {
  const frame = getScanPreviewFrame(sample.bounds, up);
  const result = await projectLocalScanSlice(sample, {
    frame,
    lower: frame.min[2],
    upper: frame.max[2],
    resolution: 1024,
  });
  const file = await sliceImageFile(result, "density", "scan-zone.png");
  const extent = { min: frame.min[2], max: frame.max[2] };
  const height = getUsefulScanHeight(
    sample.positions,
    frame.rows.slice(8),
    extent
  );
  const padded = getSliceDomain(height.min, height.max);
  return {
    url: URL.createObjectURL(file),
    size: { width: result.width, height: result.height },
    pxPerMeter: 1 / result.pixelSize,
    bbox: frame.bbox,
    extent,
    useful: {
      min: Math.max(extent.min, padded.min),
      max: Math.min(extent.max, padded.max),
    },
  };
}
