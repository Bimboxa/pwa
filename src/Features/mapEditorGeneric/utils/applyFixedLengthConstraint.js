export default function applyFixedLengthConstraint({
  lastPointPx,
  candidatePointPx,
  fixedLengthMeters,
  meterPerPixel,
}) {
  if (!lastPointPx || !candidatePointPx) return candidatePointPx;

  const lengthMeters = Number(fixedLengthMeters);
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) {
    return candidatePointPx;
  }

  if (!Number.isFinite(meterPerPixel) || meterPerPixel <= 0) {
    return candidatePointPx;
  }

  const targetDistancePx = lengthMeters / meterPerPixel;
  if (!Number.isFinite(targetDistancePx) || targetDistancePx <= 0) {
    return candidatePointPx;
  }

  const dx = candidatePointPx.x - lastPointPx.x;
  const dy = candidatePointPx.y - lastPointPx.y;
  const dist = Math.hypot(dx, dy);

  if (!Number.isFinite(dist) || dist <= 1e-6) {
    return {
      x: lastPointPx.x + targetDistancePx,
      y: lastPointPx.y,
    };
  }

  const scale = targetDistancePx / dist;
  return {
    x: lastPointPx.x + dx * scale,
    y: lastPointPx.y + dy * scale,
  };
}

