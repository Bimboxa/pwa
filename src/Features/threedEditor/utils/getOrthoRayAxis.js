// Direction of the walk-mode perpendicular measure (Shift): one of the six
// half-axes of the displayed frame (± X / Y / Z of getUserAxesWorldDirections),
// the one the crosshair aims toward from the first point `start` — the
// half-axis most aligned with start → aimPoint; `fallbackDir` (the camera's
// view direction) when the aimed point sits on the first point.
// → {key, color, dir (signed unit Vector3), id ("X+" | "X-" | …)}
export default function getOrthoRayAxis(
  start,
  aimPoint,
  userAxes,
  fallbackDir,
  epsilon = 0.02
) {
  if (!userAxes?.length) return null;
  let toward = aimPoint.clone().sub(start);
  if (toward.length() <= epsilon) toward = fallbackDir.clone();
  if (toward.lengthSq() < 1e-12) return null;
  toward.normalize();
  let best = null;
  for (const axis of userAxes) {
    const along = toward.dot(axis.dir);
    const score = Math.abs(along);
    if (best && score <= best.score) continue;
    const sign = along >= 0 ? 1 : -1;
    best = {
      score,
      key: axis.key,
      color: axis.color,
      dir: axis.dir.clone().multiplyScalar(sign).normalize(),
      id: `${axis.key}${sign > 0 ? "+" : "-"}`,
    };
  }
  if (!best) return null;
  const { key, color, dir, id } = best;
  return { key, color, dir, id };
}
