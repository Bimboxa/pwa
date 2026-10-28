// Turns the sparse "highest point per cell" grid of a point cloud into a
// continuous sheet: each empty cell takes the mean of its filled
// 8-neighbours, pass after pass (a dilation by `passes` cells), so the small
// gaps between scan points close while real holes (wider than 2 × passes
// cells) stay empty. Empty = 0 for the Uint16 height maps
// (rasterizeLocalScanHeightMap), NaN for the Float32 previews
// (projectLocalScanHeightPreview). In place; → data.
// Pure module: runs in the projection worker and in the node tests.
export const DEFAULT_FILL_PASSES = 6;

export default function fillHeightGridHoles(
  data,
  cols,
  rows,
  passes = DEFAULT_FILL_PASSES
) {
  const isFloat = data instanceof Float32Array;
  const isEmpty = isFloat ? (v) => Number.isNaN(v) : (v) => v === 0;
  const source = isFloat
    ? new Float32Array(data.length)
    : new Uint16Array(data.length);
  for (let pass = 0; pass < passes; pass++) {
    source.set(data);
    let filled = 0;
    for (let row = 0; row < rows; row++) {
      const r0 = Math.max(0, row - 1),
        r1 = Math.min(rows - 1, row + 1);
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (!isEmpty(source[index])) continue;
        const c0 = Math.max(0, col - 1),
          c1 = Math.min(cols - 1, col + 1);
        let sum = 0,
          count = 0;
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            const value = source[r * cols + c];
            if (isEmpty(value)) continue;
            sum += value;
            count++;
          }
        if (count < 2) continue;
        data[index] = isFloat
          ? sum / count
          : Math.max(1, Math.round(sum / count));
        filled++;
      }
    }
    if (!filled) break;
  }
  return data;
}
