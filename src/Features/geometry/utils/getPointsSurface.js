// points = [{x,y},{x,y},...]

export default function getPointsSurface(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  let surface = 0;
  const n = points.length;

  for (let i = 0; i < n; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % n];

    if (!current || !next) continue;

    const cx = current.x ?? 0;
    const cy = current.y ?? 0;
    const nx = next.x ?? 0;
    const ny = next.y ?? 0;

    surface += cx * ny - nx * cy;
  }

  return Math.abs(surface) / 2;
}
