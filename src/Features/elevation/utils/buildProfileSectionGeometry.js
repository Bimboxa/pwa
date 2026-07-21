// Developed section of ONE shell profile line for the elevation editor.
//
// X = CURVILINEAR distance along the profile polyline (plan px) — not a
// projection on the seed segment: a free profile may bend, and a projection
// would fold back on direction reversals (ambiguous x → height). The
// curvilinear axis is bijective and matches exactly what the 3D shell builds
// vertically above the profile path.
// Y = -(z_m) / meterByPx (screen y down), same convention as
// buildElevationProfile: z_top = height + vertexHeight + offsetZ.
//
// Input profilePoints: resolved [{x, y, height, locked?}, ...] (heights in
// meters, endpoints continuity-baked and flagged `locked`).
// Returns { vertices: [{ s, topY, height, vertexIndex, locked }], bbox } or
// null.
export default function buildProfileSectionGeometry({
  profilePoints,
  meterByPx,
  height = 0,
  offsetZ = 0,
}) {
  if (!Array.isArray(profilePoints) || profilePoints.length < 2) return null;
  if (!meterByPx || !(meterByPx > 0)) return null;

  const pts = profilePoints.filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 2) return null;

  const pxPerMeter = 1 / meterByPx;
  const last = pts.length - 1;

  let s = 0;
  const vertices = pts.map((p, i) => {
    if (i > 0) {
      s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }
    const h = Number(p.height) || 0;
    const zTop = height + h + offsetZ;
    return {
      s,
      topY: -zTop * pxPerMeter,
      height: h,
      vertexIndex: i,
      locked: p.locked === true || i === 0 || i === last,
    };
  });

  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.topY < minY) minY = v.topY;
    if (v.topY > maxY) maxY = v.topY;
  }

  return {
    vertices,
    bbox: {
      minX: 0,
      maxX: vertices[vertices.length - 1].s,
      minY,
      maxY,
    },
  };
}
