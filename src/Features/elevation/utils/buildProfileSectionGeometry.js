// Developed section of ONE shell profile line for the elevation editor.
//
// X axis depends on the profile kind:
//   - POLYGON shells (lockEndpoints=true): CURVILINEAR distance along the
//     profile polyline (plan px) — matches exactly what the 3D shell builds
//     vertically above the profile path (the shell surface is a function of
//     plan position, so the section cannot fold back anyway).
//   - POLYLINE extrusions (lockEndpoints=false): SIGNED projection of each
//     vertex onto the cut AXIS (the first → last chord). The cross-section is
//     completely FREE (Z / U shapes fold back along the axis), so a bijective
//     curvilinear abscissa cannot represent it — the signed abscissa can, and
//     the plan chain (collinear points on the cut line) reads as a plain
//     segment in the 2D map, which is exactly the profile's plan projection.
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
  // POLYGON shells lock the endpoints (contour continuity); POLYLINE
  // extrusion cross-sections keep them free.
  lockEndpoints = true,
}) {
  if (!Array.isArray(profilePoints) || profilePoints.length < 2) return null;
  if (!meterByPx || !(meterByPx > 0)) return null;

  const pts = profilePoints.filter(
    (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  );
  if (pts.length < 2) return null;

  const pxPerMeter = 1 / meterByPx;
  const last = pts.length - 1;

  // abscissa per vertex — see the header comment
  let sOf;
  if (lockEndpoints) {
    const cum = [0];
    for (let i = 1; i < pts.length; i += 1) {
      cum.push(
        cum[i - 1] +
          Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      );
    }
    sOf = (_p, i) => cum[i];
  } else {
    const axis = getProfileAxis(pts);
    if (!axis) return null;
    sOf = (p) => (p.x - axis.ox) * axis.ux + (p.y - axis.oy) * axis.uy;
  }

  const vertices = pts.map((p, i) => {
    const h = Number(p.height) || 0;
    const zTop = height + h + offsetZ;
    return {
      s: sOf(p, i),
      topY: -zTop * pxPerMeter,
      height: h,
      vertexIndex: i,
      locked: lockEndpoints && (p.locked === true || i === 0 || i === last),
      // "circle" = arc control point of the vertical section curve (S-C-S).
      type: p.type === "circle" ? "circle" : "square",
    };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.s < minX) minX = v.s;
    if (v.s > maxX) maxX = v.s;
    if (v.topY < minY) minY = v.topY;
    if (v.topY > maxY) maxY = v.topY;
  }

  return {
    vertices,
    bbox: { minX, maxX, minY, maxY },
  };
}

// Cut axis of a FREE profile: unit direction of the first → last chord, with
// the first vertex as origin. A folded profile (U) may bring its endpoints
// close together — fall back to the dominant bbox direction, then to +X, so
// the axis never degenerates.
export function getProfileAxis(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const p0 = pts[0];
  const pL = pts[pts.length - 1];
  let dx = pL.x - p0.x;
  let dy = pL.y - p0.y;
  if (Math.hypot(dx, dy) < 1e-6) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    dx = maxX - minX;
    dy = maxY - minY;
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
    if (Math.hypot(dx, dy) < 1e-6) {
      dx = 1;
      dy = 0;
    }
  }
  const len = Math.hypot(dx, dy);
  return { ox: p0.x, oy: p0.y, ux: dx / len, uy: dy / len };
}
