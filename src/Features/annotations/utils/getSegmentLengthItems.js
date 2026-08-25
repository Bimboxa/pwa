import { typeOf } from "Features/geometry/utils/arcSampling";

import getCoteDisplayValue from "./getCoteDisplayValue";

// Pure geometry + formatting for the per-segment length labels shown on a
// selected POLYLINE / POLYGON / STRIP in EDIT mode (sibling of
// getRulerSegments, without the parallel-offset chain: labels sit on the
// segment midpoints themselves).
//
// `points` are the RESOLVED pixel points of the annotation, in order, with no
// duplicated closing point. Segment k = points[k] → points[(k+1) % n];
// `closed` adds the wrapping segment n-1 — the same indexing as
// NodeStripStatic's directorSegments and buildPathAndMap's wrap.
//
// A segment touching a "circle"-type point is half of a square-circle-square
// arc triplet (or a Bézier fallback): its straight-line midpoint and length
// would be wrong, so it is flagged `isStraight: false` and gets no label.
export default function getSegmentLengthItems({
  points,
  closed = false,
  meterByPx,
  unit = "M",
  decimals = 2,
  showUnitLabel = true,
}) {
  const pts = (points || []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  const n = pts.length;
  if (n < 2) return [];

  const segmentCount = closed ? n : n - 1;
  const items = [];

  for (let i = 0; i < segmentCount; i++) {
    const P1 = pts[i];
    const P2 = pts[(i + 1) % n];
    const pixelDistance = Math.hypot(P2.x - P1.x, P2.y - P1.y);
    const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;

    items.push({
      index: i,
      startPointId: P1.id,
      endPointId: P2.id,
      P1,
      P2,
      mid: { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 },
      pixelDistance,
      meters: hasScale ? pixelDistance * meterByPx : null,
      isStraight: typeOf(P1) !== "circle" && typeOf(P2) !== "circle",
      text: getCoteDisplayValue({
        p1: P1,
        p2: P2,
        meterByPx,
        unit,
        decimals,
        showUnitLabel,
      }),
    });
  }

  return items;
}
