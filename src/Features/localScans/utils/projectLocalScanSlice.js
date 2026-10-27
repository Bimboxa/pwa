// Every source point in the inclusive Z interval contributes once. Empty
// pixels stay white; no interpolation or guessed wall geometry is introduced.
// Row 0 is the frame's minimum Y: displayed Y is world +Z, so the image top
// is world -Z, the view from above shared with horizontal base maps.
// frame.raster ({width, height, pixelSize}) imposes the raster of an existing
// base map (getLocalScanBaseMapFrame) instead of fitting the frame bounds.
export default async function projectLocalScanSlice(
  { positions, colors },
  { frame, lower, upper, resolution = 768 },
  { isCancelled = () => false, yieldControl = () => Promise.resolve() } = {}
) {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper)
    throw new Error("Intervalle Z invalide.");
  const { min, max, rows: r, raster } = frame;
  if (
    !raster &&
    (!Number.isInteger(resolution) || resolution < 16 || resolution > 1024)
  )
    throw new Error("Résolution de projection invalide.");
  if (
    raster &&
    !(
      Number.isInteger(raster.width) &&
      Number.isInteger(raster.height) &&
      raster.width > 0 &&
      raster.height > 0 &&
      raster.width * raster.height <= 64_000_000 &&
      raster.pixelSize > 0
    )
  )
    throw new Error("Image du fond de plan invalide.");
  const spanX = Math.max(0, max[0] - min[0]),
    spanY = Math.max(0, max[1] - min[1]);
  const pixelSize =
    raster?.pixelSize ?? Math.max(spanX, spanY, 0.01) / resolution;
  const width =
    raster?.width ??
    Math.max(1, Math.min(resolution, Math.ceil(spanX / pixelSize)));
  const height =
    raster?.height ??
    Math.max(1, Math.min(resolution, Math.ceil(spanY / pixelSize)));
  const size = width * height;
  const counts = new Uint32Array(size);
  // A pixel can receive millions of points; Uint32 RGB sums would overflow.
  const sums = new Float64Array(size * 3);
  let pointCount = 0,
    maxCount = 0;
  const chunkSize = 262144;
  for (let start = 0; start < positions.length / 3; start += chunkSize) {
    if (isCancelled()) return null;
    const end = Math.min(positions.length / 3, start + chunkSize);
    for (let i = start; i < end; i++) {
      const k = i * 3,
        x = positions[k],
        y = positions[k + 1],
        z = positions[k + 2];
      const vertical = r[8] * x + r[9] * y + r[10] * z + r[11];
      if (vertical < lower || vertical > upper) continue;
      const u = r[0] * x + r[1] * y + r[2] * z + r[3];
      const v = r[4] * x + r[5] * y + r[6] * z + r[7];
      let col = Math.floor((u - min[0]) / pixelSize),
        row = Math.floor((v - min[1]) / pixelSize);
      // A fixed raster crops what falls outside; a fitted one clamps its
      // maximal boundaries inside.
      if (raster && (col < 0 || row < 0 || col >= width || row >= height))
        continue;
      col = Math.max(0, Math.min(width - 1, col));
      row = Math.max(0, Math.min(height - 1, row));
      const pixel = row * width + col;
      const count = ++counts[pixel];
      maxCount = Math.max(maxCount, count);
      sums[pixel * 3] += colors[k];
      sums[pixel * 3 + 1] += colors[k + 1];
      sums[pixel * 3 + 2] += colors[k + 2];
      pointCount++;
    }
    // Yield to the worker event loop, allowing a newer range to cancel this job.
    await yieldControl();
  }
  if (isCancelled()) return null;
  const rgb = new Uint8ClampedArray(size * 4).fill(255);
  const density = new Uint8ClampedArray(size * 4).fill(255);
  const denominator = Math.log1p(maxCount) || 1;
  for (let i = 0; i < size; i++) {
    if (!counts[i]) continue;
    const shade = 255 - Math.round((255 * Math.log1p(counts[i])) / denominator);
    for (let c = 0; c < 3; c++) {
      rgb[i * 4 + c] = Math.round(sums[i * 3 + c] / counts[i]);
      density[i * 4 + c] = shade;
    }
  }
  return {
    rgb,
    density,
    width,
    height,
    pixelSize,
    pointCount,
    maxCount,
    lower,
    upper,
  };
}
