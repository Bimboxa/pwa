// Height preview of a slice: per pixel of the projection raster (the one
// of projectLocalScanSlice, imposed through `raster`), the HIGHEST vertical
// coordinate (frame vertical, world Y) of the points of `range` — what the
// height map of the base map (rasterizeLocalScanHeightMap, same filter)
// will see from above. Empty pixels hold NaN.
// The gaps between points are closed like in the height map
// (fillHeightGridHoles; `fillPasses` 0 = none).
// query: {frame, raster: {width, height, pixelSize}, range: [lo, hi],
// fillPasses?} → {width, height, pixelSize, heights: Float32Array, min,
// max, count}
// Pure module: runs in the projection worker and in the node tests.
import fillHeightGridHoles from "./fillHeightGridHoles.js";

export default function projectLocalScanHeightPreview(
  { positions },
  { frame, raster, range, fillPasses }
) {
  const { min, rows: r } = frame;
  const { width, height, pixelSize } = raster ?? {};
  if (
    !(
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      pixelSize > 0
    )
  )
    throw new Error("Image du fond de plan invalide.");
  const lo = range?.[0] ?? -Infinity;
  const hi = range?.[1] ?? Infinity;
  const heights = new Float32Array(width * height).fill(NaN);
  let count = 0,
    hMin = Infinity,
    hMax = -Infinity;
  const total = positions.length / 3;
  for (let i = 0; i < total; i++) {
    const k = i * 3,
      x = positions[k],
      y = positions[k + 1],
      z = positions[k + 2];
    const vertical = r[8] * x + r[9] * y + r[10] * z + r[11];
    if (vertical < lo || vertical > hi) continue;
    const u = r[0] * x + r[1] * y + r[2] * z + r[3];
    const v = r[4] * x + r[5] * y + r[6] * z + r[7];
    const col = Math.floor((u - min[0]) / pixelSize),
      row = Math.floor((v - min[1]) / pixelSize);
    if (col < 0 || row < 0 || col >= width || row >= height) continue;
    const pixel = row * width + col;
    const current = heights[pixel];
    if (Number.isNaN(current)) count++;
    if (Number.isNaN(current) || vertical > current) heights[pixel] = vertical;
    if (vertical < hMin) hMin = vertical;
    if (vertical > hMax) hMax = vertical;
  }
  if (count && fillPasses !== 0)
    fillHeightGridHoles(heights, width, height, fillPasses);
  return {
    width,
    height,
    pixelSize,
    heights,
    min: count ? hMin : 0,
    max: count ? hMax : 0,
    count,
  };
}
