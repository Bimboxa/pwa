import getGuideLineAxis from "Features/annotations/utils/getGuideLineAxis";

// Computes the per-vertex `offsetTop` (in meters) implied by a uniform slope
// along the guideLine. The guideLine is the ramp axis: iso-height contours run
// normal (perpendicular) to it, so a vertex's height is a function of its
// arc-length projection `s` onto the guideLine only.
//
//   offsetTop = (s - sMin) * meterByPx * (slopePct / 100)
//
// `sMin` is subtracted so the lowest iso-line sits at height 0 (keeps the
// object anchored near the base instead of floating).
//
// Inputs (pixel space):
//   - guidePts:  resolved guideLine points [{x,y,type?}]
//   - vertices:  every ring vertex [{id,x,y}] (main contour + cuts + inner)
//   - meterByPx: pixel→meter scale
//   - slopePct:  slope as a percentage (rise/run * 100)
//
// Returns Map<vertexId, offsetTop> (empty when the guideLine is degenerate).
export default function applyGuideLineSlopeOffsets({
  guidePts,
  vertices,
  meterByPx,
  slopePct,
}) {
  const out = new Map();
  if (!Number.isFinite(meterByPx) || meterByPx <= 0) return out;

  const axis = getGuideLineAxis({ guidePts, polygonPts: vertices });
  if (!axis || axis.sById.size === 0) return out;

  let sMin = Infinity;
  for (const s of axis.sById.values()) {
    if (s < sMin) sMin = s;
  }
  if (!Number.isFinite(sMin)) return out;

  const k = (Number(slopePct) || 0) / 100;
  for (const [id, s] of axis.sById.entries()) {
    out.set(id, (s - sMin) * meterByPx * k);
  }
  return out;
}
