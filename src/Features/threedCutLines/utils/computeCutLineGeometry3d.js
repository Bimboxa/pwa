import getCutLineVisiblePoints from "./getCutLineVisiblePoints.js";

// Pure math for rendering a CUT_LINE in the 3D editor — plain objects in and
// out. Input points are the RESOLVED pixel points of the annotation
// (reference frame, see AnnotationsManager) carrying their db.points `id`,
// `offsetBottom` and the per-ref flags (`derived`, `stop`); output is in
// base-map-local metres, the frame of the base map group the objects are
// attached to (same projection as computeRulerGeometry3d):
//   lx = (px - imageWidth / 2) * meterByPx
//   ly = -(py - imageHeight / 2) * meterByPx
//   lz = (offsetZ || 0) + (offsetBottom || 0)
//
// Returns null without 2 finite points, else:
//   {
//     P: [{ x, y, z, id, index, derived, stop }],   // every point
//     startIndex, endIndex,                          // visible run (stops)
//     segments: [{ index, a, b, derived, hidden }],  // a = P[i], b = P[i+1]
//   }
// `derived` of a segment: one of its ends was added by the extension (dashed
// while selected); `hidden`: outside the visible run (grey while selected,
// not drawn otherwise).
export default function computeCutLineGeometry3d({
  points,
  offsetZ = 0,
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

  const P = pts.map((p, index) => ({
    x: (p.x - imageWidth / 2) * meterByPx,
    y: -(p.y - imageHeight / 2) * meterByPx,
    z: (offsetZ || 0) + (p.offsetBottom || 0),
    id: p.id,
    index,
    derived: Boolean(p.derived),
    stop: Boolean(p.stop),
  }));

  const { startIndex, endIndex } = getCutLineVisiblePoints(pts);

  const segments = [];
  for (let i = 0; i < P.length - 1; i++) {
    segments.push({
      index: i,
      a: P[i],
      b: P[i + 1],
      derived: P[i].derived || P[i + 1].derived,
      hidden: i < startIndex || i + 1 > endIndex,
    });
  }
  return { P, startIndex, endIndex, segments };
}
