// 3D counterpart of mapEditor/utils/expandConstraintLengths: a ";"-separated
// series of typed lengths ("6;0.2;2") placed in one click, collinear from the
// last vertex along `last → direction` (the scene works in metres).
//
// Dependency free ({x, y, z} plain objects) so it can be replayed in node.
//
// `direction` is the previewed end of the series (the snap, already rescaled
// to the series total by applyFixedLengthConstraint3d): only its direction is
// read, the distances come from `lengths`. Same radial model, so the single
// length and the series compose identically.
//
// Returns one point per length, cumulated from `last` (which is NOT
// included). Empty array when there is nothing usable to place.
export default function expandConstraintLengths3d({
  last,
  direction,
  lengths,
}) {
  if (!last || !direction) return [];
  if (!Array.isArray(lengths) || lengths.length === 0) return [];

  const dx = direction.x - last.x;
  const dy = direction.y - last.y;
  const dz = direction.z - last.z;
  const dist = Math.hypot(dx, dy, dz);

  // Cursor sitting on the last vertex: no direction to read. Fall back to
  // +X, matching applyFixedLengthConstraint3d's own degenerate case.
  const ux = dist > 1e-6 ? dx / dist : 1;
  const uy = dist > 1e-6 ? dy / dist : 0;
  const uz = dist > 1e-6 ? dz / dist : 0;

  const points = [];
  let cumulated = 0;
  for (const length of lengths) {
    const value = Number(length);
    if (!Number.isFinite(value) || value <= 0) return [];
    cumulated += value;
    points.push({
      x: last.x + ux * cumulated,
      y: last.y + uy * cumulated,
      z: last.z + uz * cumulated,
    });
  }

  return points;
}
