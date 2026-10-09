// A segment runs along a user axis above this |cos| (0.5°).
const PARALLEL_COS = Math.cos((0.5 * Math.PI) / 180);
// Under this length (m) a segment has no direction.
const MIN_LENGTH_M = 1e-3;

// Key ("X" | "Y" | "Z") of the user axis (gizmo frame, see
// getUserAxesWorldDirections) the segment from → to runs along, either way;
// null when it follows none — the drawing helpers then keep their neutral
// colour and the length badge its plain text.
export default function getSegmentUserAxis(from, to, userAxes = []) {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length < MIN_LENGTH_M) return null;
  for (const axis of userAxes) {
    const { x, y, z } = axis.dir;
    const norm = Math.sqrt(x * x + y * y + z * z) || 1;
    const cos = Math.abs(dx * x + dy * y + dz * z) / (length * norm);
    if (cos >= PARALLEL_COS) return axis.key;
  }
  return null;
}
