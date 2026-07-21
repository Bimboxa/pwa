import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";

// Pins the surface height (`offsetTop`) of every ring vertex that lies ON an
// isoHeightLine to that line's height. Vertices NOT on an iso line keep their
// own stored offsetTop — the iso lines pin fold heights, they do not drive a
// global interpolated field (a contour vertex must stay fixed when an iso
// line is dragged; the sloped faces between constraints are built by the 3D
// partition, each region interpolating its own boundary heights).
//
// Evaluated at resolve time (useAnnotationsV2) rather than baked into stored
// points: a vertex added/moved onto the line afterwards automatically follows
// it, and deleting the line releases the vertices with nothing to un-bake.
//
// All inputs are in pixel space (resolved). Returns { points, cuts,
// innerPoints } with `offsetTop` pinned on touching vertices; everything else
// is preserved.

// A vertex "lies on" an iso line below this distance (image px) — matches the
// weld tolerance of the 3D partition (commit projects endpoints exactly onto
// the contour, so real cases sit at ~float distance).
const ON_LINE_TOL_PX = 1.5;

export default function applyIsoHeightLinesToRings({
  points,
  cuts,
  innerPoints,
  isoHeightLines,
}) {
  const result = { points, cuts, innerPoints };

  const isValidPt = (p) =>
    p && typeof p.x === "number" && typeof p.y === "number";

  const lines = (isoHeightLines || [])
    .map((l) => ({
      polyline: (l?.points || [])
        .filter(isValidPt)
        .map((p) => ({ x: p.x, y: p.y })),
      height: Number(l?.height) || 0,
    }))
    .filter((l) => l.polyline.length >= 2);
  if (lines.length === 0) return result;

  const pinnedHeightAt = (p) => {
    for (const line of lines) {
      const proj = projectPointOnPolyline(p, line.polyline);
      if (proj && proj.distance <= ON_LINE_TOL_PX) return line.height;
    }
    return null;
  };

  const applyRing = (ring) =>
    (ring || []).map((p) => {
      if (!isValidPt(p)) return p;
      const h = pinnedHeightAt(p);
      return h == null ? p : { ...p, offsetTop: h };
    });

  result.points = applyRing(points);
  if (Array.isArray(cuts)) {
    result.cuts = cuts.map((c) => ({ ...c, points: applyRing(c?.points) }));
  }
  if (Array.isArray(innerPoints)) {
    result.innerPoints = applyRing(innerPoints);
  }
  return result;
}
