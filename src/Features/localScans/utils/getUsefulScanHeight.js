// A bounded, stratified sample keeps slider setup cheap even for multi-GB scans.
// Only the slider extent changes; projection and rendering keep every point.
export default function getUsefulScanHeight(positions, row, fallback) {
  const count = Math.floor(positions.length / 3);
  const size = Math.min(count, 65536);
  if (size < 100) return fallback;
  const heights = new Float64Array(size);
  let valid = 0;
  for (let i = 0; i < size; i++) {
    const offset = Math.floor(((i + 0.5) * count) / size) * 3;
    const height =
      row[0] * positions[offset] +
      row[1] * positions[offset + 1] +
      row[2] * positions[offset + 2] +
      row[3];
    if (Number.isFinite(height)) heights[valid++] = height;
  }
  if (valid < 100) return fallback;
  const sorted = heights.subarray(0, valid).sort();
  const min = sorted[Math.floor((valid - 1) * 0.01)];
  const max = sorted[Math.ceil((valid - 1) * 0.99)];
  return { min, max };
}
