// Rows map source XYZ to the displayed X/Y/Z frame (Z = world Y).
// Taking the dot products after the scan transform preserves scale and origin.
export default function getLocalScanSliceFrame(bounds, m, yawDeg = 0) {
  const angle = (yawDeg * Math.PI) / 180;
  const xDirection = [Math.cos(angle), 0, -Math.sin(angle)];
  const yDirection = [Math.sin(angle), 0, Math.cos(angle)];
  const directions = [xDirection, yDirection, [0, 1, 0]];
  const rows = directions.flatMap((d) =>
    [0, 4, 8, 12].map(
      (offset) => d[0] * m[offset] + d[1] * m[offset + 1] + d[2] * m[offset + 2]
    )
  );
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const p = [0, 1, 2].map(
      (axis) => bounds[(corner >> axis) & 1 ? "max" : "min"][axis]
    );
    for (let axis = 0; axis < 3; axis++) {
      const r = axis * 4;
      const value =
        rows[r] * p[0] + rows[r + 1] * p[1] + rows[r + 2] * p[2] + rows[r + 3];
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return { rows, min, max, xDirection, yDirection };
}
