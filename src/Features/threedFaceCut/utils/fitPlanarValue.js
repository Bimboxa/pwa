// Least-squares plane value = a·x + b·y + c through plan samples
// [{x, y, value}]: the per-vertex offsets of a planar (sloped) polygon,
// evaluated at a new plan point. Constant samples (a flat polygon), or
// samples too aligned to carry a plane, give their mean.
export default function fitPlanarValue(samples) {
  if (!samples?.length) return () => 0;
  const mean =
    samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length;
  if (samples.every((sample) => Math.abs(sample.value - mean) < 1e-9)) {
    return () => mean;
  }

  // Normal equations, centered for conditioning.
  const cx = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
  const cy = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxv = 0;
  let syv = 0;
  for (const s of samples) {
    const x = s.x - cx;
    const y = s.y - cy;
    const v = s.value - mean;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sxv += x * v;
    syv += y * v;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) <= 1e-12 * Math.max(1, sxx * syy)) return () => mean;
  const a = (sxv * syy - syv * sxy) / det;
  const b = (syv * sxx - sxv * sxy) / det;
  return (x, y) => mean + a * (x - cx) + b * (y - cy);
}
