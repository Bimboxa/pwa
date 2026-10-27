const DEG = Math.PI / 180;

// Horizontal (floor, ceiling) or vertical (wall) plane, within `toleranceDeg`
// of the world Y axis: the fitted normal is snapped exactly. Oblique planes
// keep their fitted normal. normal: [x, y, z] world unit vector.
// → {normal, orientation: "HORIZONTAL" | "VERTICAL" | null}
export default function classifyScanPlaneNormal(normal, toleranceDeg = 12) {
  const [x, y, z] = normal;
  if (Math.abs(y) >= Math.cos(toleranceDeg * DEG))
    return { normal: [0, Math.sign(y), 0], orientation: "HORIZONTAL" };
  if (Math.abs(y) <= Math.sin(toleranceDeg * DEG)) {
    const length = Math.hypot(x, z);
    return { normal: [x / length, 0, z / length], orientation: "VERTICAL" };
  }
  return { normal: [x, y, z], orientation: null };
}
