import getGuideLineRampSampler from "Features/annotations/utils/getGuideLineRampSampler";

// Derives the ramp height (`offsetTop`, meters) of every polygon vertex from a
// SEQUENCE of guideLines, each with its own slope. The guideLines follow one
// another (drawing order = ramp order); the first defines the low point.
//
// Height accumulates along the concatenated spine: within guideLine i the
// height rises by slope_i; the cumulative base of line i is the height reached
// at the end of all previous lines (continuity at junctions).
//
// Each vertex is assigned to its NEAREST guideLine (projected independently per
// line, so end-to-end gaps don't create spurious connector segments). Clamping
// at a line's end yields exactly the next line's base height → continuous ramp.
//
// The heavy lifting (spine construction + globalMin rebasing) lives in
// getGuideLineRampSampler; this wrapper just samples every ring vertex so the
// per-vertex map and the geometric sampler share one source of truth.
//
// Inputs (pixel space):
//   - guideLines: [{ points: [{x,y,type?}], slopePct }]  (resolved)
//   - polygonPts: every ring vertex [{id,x,y}]
//   - meterByPx:  pixel→meter scale
//
// Returns Map<vertexId, offsetTop> (empty when no usable guideLine).
export default function getGuideLinesRampOffsets({
  guideLines,
  polygonPts,
  meterByPx,
}) {
  const out = new Map();
  const sampler = getGuideLineRampSampler({
    guideLines,
    polygonPts,
    meterByPx,
  });
  if (!sampler.ok) return out;

  for (const v of polygonPts || []) {
    if (!v?.id || typeof v.x !== "number" || typeof v.y !== "number") continue;
    out.set(v.id, sampler.groundAt(v));
  }
  return out;
}
