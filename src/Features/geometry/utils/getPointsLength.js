// points = [{x,y},{x,y},...]

export default function getPointsLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;

  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    if (!prev || !curr) continue;

    const dx = (curr.x ?? 0) - (prev.x ?? 0);
    const dy = (curr.y ?? 0) - (prev.y ?? 0);
    length += Math.hypot(dx, dy);
  }

  return length;
}
