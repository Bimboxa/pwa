import { getRulerSegmentKeys } from "Features/annotations/utils/getRulerSegmentKey";
import offsetPolylineParallel from "Features/geometry/utils/offsetPolylineParallel";

// A chain whose points all sit within this of one altitude (metres) is
// plane-parallel: its value cards keep to the plan under Shift locks.
const PLANE_PARALLEL_EPS_M = 5e-3;

// Pure math for rendering a RULER (dimension chain) in the 3D editor —
// plain {x,y,z} objects in, plain objects out.
//
// Input points are the RESOLVED pixel points of the annotation (reference
// frame, see AnnotationsManager) carrying per-point `offsetBottom` and their
// db.points `id`; output is in basemap-local meters, the frame of the basemap
// group the ruler objects are attached to (same projection as
// computeCoteGeometry3d):
//   lx = (px - imageWidth / 2) * meterByPx
//   ly = -(py - imageHeight / 2) * meterByPx
//   lz = (offsetZ || 0) + (offsetBottom || 0)
//
// The alignment chain is computed in PIXEL space with the very same
// offsetPolylineParallel the 2D renderer uses, then projected. That is what
// guarantees 2D and 3D put the cotes on the SAME side — the pixel-space normal
// (-uy, ux) maps through the y-flip to the local normal (u.y, -u.x), exactly the
// convention computeCoteGeometry3d documents.
//
// Each segment carries its stable `key` (getRulerSegmentKeys — the per-segment
// `rulerLabelOffsets` of the row are looked up by it) and `pixelPoints` is
// the finite-filtered list the segments index into (never index the raw
// annotation points with `seg.index`).
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
      ? ((extensionOffset || 0) * 0.01) / meterByPx
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
  const keys = getRulerSegmentKeys(pts);

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
      key: keys[i],
      startPointId: pts[i].id,
      endPointId: pts[i + 1].id,
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

  const z0 = P[0].z;
  const isPlaneParallel = P.every(
    (p) => Math.abs(p.z - z0) < PLANE_PARALLEL_EPS_M
  );

  return {
    P,
    D,
    pixelPoints: pts,
    segments,
    totalMeters,
    hasOffset: Math.abs(offsetPx) * meterByPx > 1e-4,
    isPlaneParallel,
  };
}
