import { collectLocalScanSlicePointsInWorker } from "Features/localScans/services/projectLocalScanInWorker";
import getLocalScanSectionFrame from "Features/localScans/utils/getLocalScanSectionFrame";

import vectorizeSliceFootprint from "../utils/vectorizeSliceFootprint";

// Grid cell of the vectorization, from the slice half thickness: a thinner
// slice is a thinner ribbon, worth a finer grid.
const MIN_CELL_M = 0.005;
const MAX_CELL_M = 0.02;

// Vectorization of the point clouds cut by a page: the points within
// `toleranceM` of the page plane (what the plane "prints", same slab as
// printLocalScanSectionService) — or in `range` ({lower, upper}, signed
// distances to the plane: a layer in front of / behind it) — are vectorized
// by vectorizeSliceFootprint.
// Nothing is written: the caller turns the polylines into annotations
// (buildVectorizedSectionRows).
//
// clouds: [{data: {positions, colors}, matrixWorld: Matrix4}];
// page: {position, angleDeg, orientation, width, height (px), meterByPx}.
// → { polylines, pointCount, stats }: polylines in metres from the image
// top-left corner (y down); empty when no point falls in the slab.
export default async function vectorizeLocalScanSectionService({
  clouds,
  page,
  toleranceM,
  range = null,
}) {
  const result = { polylines: [], pointCount: 0, stats: null };
  const lower = range ? range.lower : -toleranceM;
  const upper = range ? range.upper : toleranceM;
  if (!clouds?.length || !(lower <= upper)) return result;
  // cell from the slab half thickness; a thick layer keeps the coarse one
  const cellSize = Math.min(
    MAX_CELL_M,
    Math.max(MIN_CELL_M, range ? MAX_CELL_M / 2 : toleranceM)
  );

  const parts = [];
  // One cloud at a time: each job clones its positions into a worker.
  for (const cloud of clouds) {
    const slice = await collectLocalScanSlicePointsInWorker(cloud.data, {
      frame: getLocalScanSectionFrame(cloud.matrixWorld, page),
      lower,
      upper,
    });
    if (slice?.count) parts.push(slice.points);
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  if (!total) return result;
  const points = new Float32Array(total);
  let offset = 0;
  parts.forEach((part) => {
    points.set(part, offset);
    offset += part.length;
  });

  const { polylines, stats } = vectorizeSliceFootprint({
    points,
    cellSize,
  });
  console.log(
    `[baseMapClipping] section vectorization: ${total / 2} points, ${stats.chainCount} chain(s), ${polylines.length} polyline(s) kept`,
    stats
  );
  return { polylines, pointCount: total / 2, stats };
}
