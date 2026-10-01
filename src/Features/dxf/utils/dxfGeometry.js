const TAU = Math.PI * 2;

export function transform(p, m) {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function sampleArc(center, radius, start, sweep) {
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / (TAU / 256)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = start + (sweep * i) / count;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });
}

export function polylinePoints(vertices, closed) {
  const points = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const bulge = a.bulge ?? 0;
    if (!bulge || Math.hypot(b.x - a.x, b.y - a.y) < 1e-12) {
      points.push(a);
      continue;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const factor = (1 - bulge * bulge) / (4 * bulge);
    const center = {
      x: (a.x + b.x) / 2 - dy * factor,
      y: (a.y + b.y) / 2 + dx * factor,
    };
    points.push(
      ...sampleArc(
        center,
        Math.hypot(a.x - center.x, a.y - center.y),
        Math.atan2(a.y - center.y, a.x - center.x),
        4 * Math.atan(bulge)
      ).slice(0, -1)
    );
  }
  if (!closed && vertices.length) points.push(vertices[vertices.length - 1]);
  return points;
}
