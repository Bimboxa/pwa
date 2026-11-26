// Points of a scan lying in a slice, in the 2D frame of the slice — the
// exact coordinates, where projectLocalScanSlice bins them into a raster.
// Input of the section vectorization (« Vectoriser la coupe »).
//
// Same frame contract as projectLocalScanSlice: `frame.rows` maps a source
// point to (u, v, vertical); a point is kept when `vertical` is in
// [lower, upper] and (u, v) falls inside [frame.min, frame.max]. With
// getLocalScanSectionFrame, `vertical` is the signed distance to the page
// plane and the output is in metres from the image top-left corner, x to
// the right, y DOWN (x / (width · meterByPx) is the normalized image x).
//
// A slice holding more than `maxPoints` is thinned evenly (every other point
// dropped, again and again): the footprint keeps its shape.
// → { points: Float32Array [x0, y0, x1, y1, …], count, sliceCount }
export default function collectLocalScanSlicePoints(
  { positions },
  { frame, lower, upper, maxPoints = 2_000_000 }
) {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper)
    throw new Error("Intervalle de coupe invalide.");
  const { min, max, rows: r } = frame;
  const spanU = max[0] - min[0],
    spanV = max[1] - min[1];
  const capacity = Math.max(1, Math.floor(maxPoints));

  const points = new Float32Array(capacity * 2);
  let count = 0,
    sliceCount = 0,
    // one point out of `keepEvery` is stored
    keepEvery = 1;
  const total = Math.floor(positions.length / 3);
  for (let i = 0; i < total; i++) {
    const k = i * 3,
      x = positions[k],
      y = positions[k + 1],
      z = positions[k + 2];
    const vertical = r[8] * x + r[9] * y + r[10] * z + r[11];
    if (vertical < lower || vertical > upper) continue;
    const u = r[0] * x + r[1] * y + r[2] * z + r[3] - min[0];
    const v = r[4] * x + r[5] * y + r[6] * z + r[7] - min[1];
    if (u < 0 || v < 0 || u > spanU || v > spanV) continue;
    if (sliceCount++ % keepEvery !== 0) continue;
    if (count === capacity) {
      // full: keep every other stored point, halve the sampling rate
      const half = Math.ceil(count / 2);
      for (let j = 0; j < half; j++) {
        points[j * 2] = points[j * 4];
        points[j * 2 + 1] = points[j * 4 + 1];
      }
      count = half;
      keepEvery *= 2;
      if ((sliceCount - 1) % keepEvery !== 0) continue;
    }
    points[count * 2] = u;
    points[count * 2 + 1] = v;
    count++;
  }
  return { points: points.slice(0, count * 2), count, sliceCount };
}
