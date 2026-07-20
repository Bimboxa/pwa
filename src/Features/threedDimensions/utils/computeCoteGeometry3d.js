// Pure math for rendering a COTE annotation in the 3D editor — dependency
// free ({x,y,z} plain objects) so it can be replayed in node.
//
// Input points are the RESOLVED pixel points of the annotation (reference
// frame, see AnnotationsManager) carrying per-point `offsetBottom`; output is
// in basemap-local meters (x right, y up — pixel y-flip — z along the plane
// normal), the frame of the basemap group the cote objects are attached to:
//   lx = (px - imageWidth / 2) * meterByPx
//   ly = -(py - imageHeight / 2) * meterByPx
//   lz = (offsetZ || 0) + (offsetBottom || 0)
//
// Offset of the dimension line vs the measured segment:
//   - plane-parallel cote (both endpoints at the same z): the 2D
//     `extensionOffset` applies, along the in-plane normal
//     n_local = (u.y, -u.x, 0) — the pixel-space normal (-uy, ux) mapped
//     through the y-flip, so 2D and 3D display the offset on the SAME side.
//   - vertical/oblique cote: the `offset3d` vector (basemap-local meters)
//     applies, re-projected perpendicular to the segment.

const PLANE_PARALLEL_EPS_M = 5e-3;

export default function computeCoteGeometry3d({
  points,
  offsetZ = 0,
  extensionOffset = 8,
  extensionOffsetUnit = "PX",
  offset3d = null,
  imageWidth,
  imageHeight,
  meterByPx,
}) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const p1 = points[0];
  const p2 = points[1];
  if (!p1 || !p2) return null;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  if (!imageWidth || !imageHeight) return null;

  const toLocal = (p) => ({
    x: (p.x - imageWidth / 2) * meterByPx,
    y: -(p.y - imageHeight / 2) * meterByPx,
    z: (offsetZ || 0) + (p.offsetBottom || 0),
  });
  const P1 = toLocal(p1);
  const P2 = toLocal(p2);

  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const dz = P2.z - P1.z;
  const lengthMeters = Math.hypot(dx, dy, dz);
  if (lengthMeters < 1e-9) return null;
  const u = {
    x: dx / lengthMeters,
    y: dy / lengthMeters,
    z: dz / lengthMeters,
  };

  const isPlaneParallel = Math.abs(dz) < PLANE_PARALLEL_EPS_M;

  let nLocal = null;
  let V = { x: 0, y: 0, z: 0 };
  if (isPlaneParallel) {
    const planarLen = Math.hypot(u.x, u.y);
    if (planarLen > 1e-9) {
      nLocal = { x: u.y / planarLen, y: -u.x / planarLen, z: 0 };
      const offsetMeters =
        extensionOffsetUnit === "CM"
          ? (extensionOffset || 0) * 0.01
          : (extensionOffset || 0) * meterByPx;
      V = {
        x: nLocal.x * offsetMeters,
        y: nLocal.y * offsetMeters,
        z: 0,
      };
    }
  } else if (
    offset3d &&
    [offset3d.x, offset3d.y, offset3d.z].every(Number.isFinite)
  ) {
    // Defensive re-projection perpendicular to the segment: the stored
    // vector may drift (rounding, endpoint edit) — only the perpendicular
    // component is a meaningful dimension-line displacement.
    const dot = offset3d.x * u.x + offset3d.y * u.y + offset3d.z * u.z;
    V = {
      x: offset3d.x - dot * u.x,
      y: offset3d.y - dot * u.y,
      z: offset3d.z - dot * u.z,
    };
  }

  const D1 = { x: P1.x + V.x, y: P1.y + V.y, z: P1.z + V.z };
  const D2 = { x: P2.x + V.x, y: P2.y + V.y, z: P2.z + V.z };
  const mid = {
    x: (D1.x + D2.x) / 2,
    y: (D1.y + D2.y) / 2,
    z: (D1.z + D2.z) / 2,
  };

  return {
    P1,
    P2,
    D1,
    D2,
    mid,
    u,
    nLocal,
    V,
    isPlaneParallel,
    lengthMeters,
    deltaZMeters: dz,
  };
}
