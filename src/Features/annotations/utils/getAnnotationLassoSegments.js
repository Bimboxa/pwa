// Build a flat list of pickable segments for the lasso hit-test.
// Each segment exposes both endpoints (in the same coord space as the
// annotation's resolved points) plus the partId that the selection slice
// expects. Mirrors the partId encoding used by NodePolylineStatic.
//
// Returns: [{ partId, p0, p1, ringKey, segIdx }]
//
// Closed shapes (POLYGON / POLYLINE.closeLine) include a wraparound
// segment idx = N-1 connecting the last point back to the first one.
export default function getAnnotationLassoSegments(annotation) {
  if (!annotation) return [];
  const out = [];

  const isClosedMain =
    annotation.type === "POLYGON" || annotation.closeLine === true;

  pushRingSegments({
    out,
    points: annotation.points,
    ringKey: "MAIN",
    partTypeBuilder: (idx) => `${annotation.id}::SEG::${idx}`,
    isClosed: isClosedMain,
  });

  // Cuts are always closed rings on a POLYGON.
  (annotation.cuts || []).forEach((cut, cutIdx) => {
    pushRingSegments({
      out,
      points: cut?.points,
      ringKey: `CUT::${cutIdx}`,
      partTypeBuilder: (idx) => `${annotation.id}::CUT_SEG::${cutIdx}::${idx}`,
      isClosed: true,
    });
  });

  return out;
}

function pushRingSegments({ out, points, ringKey, partTypeBuilder, isClosed }) {
  if (!Array.isArray(points) || points.length < 2) return;
  const n = points.length;
  const limit = isClosed ? n : n - 1;
  for (let idx = 0; idx < limit; idx++) {
    const p0 = points[idx];
    const p1 = points[(idx + 1) % n];
    if (!p0 || !p1 || typeof p0.x !== "number" || typeof p1.x !== "number") continue;
    out.push({
      partId: partTypeBuilder(idx),
      p0,
      p1,
      ringKey,
      segIdx: idx,
    });
  }
}
