import offsetPolylineParallel from "Features/geometry/utils/offsetPolylineParallel";

// Pure math for rendering a RULER (dimension chain) in the 3D editor —
// dependency free ({x,y,z} plain objects) so it can be replayed in node.
//
// Input points are the RESOLVED pixel points of the annotation (reference
// frame, see AnnotationsManager) carrying per-point `offsetBottom`; output is
// in basemap-local meters, the frame of the basemap group the ruler objects are
// attached to (same projection as computeCoteGeometry3d):
//   lx = (px - imageWidth / 2) * meterByPx
//   ly = -(py - imageHeight / 2) * meterByPx
//   lz = (offsetZ || 0) + (offsetBottom || 0)
//
// The alignment chain is computed in PIXEL space with the very same
// offsetPolylineParallel the 2D renderer uses, then projected. That is what
// guarantees 2D and 3D put the cotes on the SAME side — the pixel-space normal
// (-uy, ux) maps through the y-flip to the local normal (u.y, -u.x), exactly the
// convention computeCoteGeometry3d documents.
export default function computeRulerGeometry3d({
  points,
  offsetZ = 0,
  extensionOffset = 8,
  extensionOffsetUnit = "PX",
  imageWidth,
  imageHeight,
  meterByPx,
}) {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return null;
  if (!imageWidth || !imageHeight) return null;

  const pts = points.filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (pts.length < 2) return null;

  // Offset expressed in image pixels, whatever the stored unit.
  const offsetPx =
    extensionOffsetUnit === "CM"
      ? (extensionOffset || 0) * 0.01 / meterByPx
      : extensionOffset || 0;

  const offsetPts = offsetPolylineParallel(pts, offsetPx);

  const toLocal = (p) => ({
    x: (p.x - imageWidth / 2) * meterByPx,
    y: -(p.y - imageHeight / 2) * meterByPx,
    z: (offsetZ || 0) + (p.offsetBottom || 0),
  });

  const P = pts.map(toLocal);
  // The offset points inherit their source point's offsetBottom through the
  // {...p} spread in offsetPolylineParallel, so they lift with the chain.
  const D = offsetPts.map(toLocal);

  const segments = [];
  let totalMeters = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const lengthMeters = Math.hypot(
      P[i + 1].x - P[i].x,
      P[i + 1].y - P[i].y,
      P[i + 1].z - P[i].z
    );
    totalMeters += lengthMeters;
    segments.push({
      index: i,
      P1: P[i],
      P2: P[i + 1],
      D1: D[i],
      D2: D[i + 1],
      mid: {
        x: (D[i].x + D[i + 1].x) / 2,
        y: (D[i].y + D[i + 1].y) / 2,
        z: (D[i].z + D[i + 1].z) / 2,
      },
      lengthMeters,
      deltaZMeters: P[i + 1].z - P[i].z,
    });
  }

  return {
    P,
    D,
    segments,
    totalMeters,
    hasOffset: Math.abs(offsetPx) * meterByPx > 1e-4,
  };
}
