// Convert a mesh cell expressed in the elevation editor's world space back into
// a POLYLINE in plan (map pixel) space carrying per-vertex offsetBottom /
// offsetTop — the inverse of useElevationProfile's projection.
//
// Elevation world: X = position along the developed wall, Y = -(Z in meters) /
// meterByPx (screen Y points down → up is negative). The `chain` maps developed
// X to a plan point:
//   chain: [{ x: developedX, plan: { x, y } }]  (sorted ascending by x)
//
// For each distinct X column of the cell we read its top (min Y) and bottom
// (max Y) and rebuild Z:
//   Z = -worldY * meterByPx
//   offsetTop    = Ztop    - height - offsetZ
//   offsetBottom = Zbottom - offsetZ
function planAtX(chain, x) {
  if (!chain || chain.length === 0) return { x: 0, y: 0 };
  if (x <= chain[0].x) return chain[0].plan;
  if (x >= chain[chain.length - 1].x) return chain[chain.length - 1].plan;
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    if (x >= a.x && x <= b.x) {
      const span = b.x - a.x || 1;
      const t = (x - a.x) / span;
      return {
        x: a.plan.x + (b.plan.x - a.plan.x) * t,
        y: a.plan.y + (b.plan.y - a.plan.y) * t,
      };
    }
  }
  return chain[chain.length - 1].plan;
}

export default function mapElevationCellToPolyline(
  cellPoints,
  { chain, meterByPx, height = 0, offsetZ = 0 }
) {
  if (!cellPoints || cellPoints.length < 3 || !meterByPx) return null;

  // group cell vertices by (rounded) X column → top/bottom Y per column
  const columns = new Map();
  for (const p of cellPoints) {
    const key = Math.round(p.x * 100) / 100;
    const col = columns.get(key);
    if (!col) {
      columns.set(key, { x: p.x, top: p.y, bottom: p.y });
    } else {
      if (p.y < col.top) col.top = p.y; // most negative = highest
      if (p.y > col.bottom) col.bottom = p.y;
    }
  }

  const sorted = [...columns.values()].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) return null;

  const points = sorted.map((col) => {
    const plan = planAtX(chain, col.x);
    const zTop = -col.top * meterByPx;
    const zBottom = -col.bottom * meterByPx;
    return {
      x: plan.x,
      y: plan.y,
      offsetTop: zTop - height - offsetZ,
      offsetBottom: zBottom - offsetZ,
    };
  });

  return { points };
}
