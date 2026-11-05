// Geometry of a COTE drawn in the "Étiquette" style (`coteStyle: "LABEL"`):
// the offset dimension bar, and the horizontal label tied to the bar's
// midpoint by a small leader.
//
// The label placement is `annotation.coteLabelOffset2d` = { x, y } in PAGE
// POINTS, relative to the bar's midpoint, in an "outward-positive" frame
// (outward = from the measured points towards the bar):
// - vertical-like bar (|dy| >= |dx|): `x` is the leader length along the
//   horizontal, positive = outward; `y` is ignored. The leader is one
//   horizontal segment.
// - horizontal-like bar: `y` is positive = outward, `x` is the plain screen
//   axis. The leader is an elbow: vertical from the bar's midpoint, then
//   horizontal to the label.
// Storing the outward component is what makes the label switch sides on its
// own when the bar crosses the measured points (extensionOffset sign flip).
//
// The label never mirrors: it reads left to right, and the leader reaches its
// first letter (textAnchor "start") or its last one ("end").

export const COTE_LABEL_DEFAULT_OFFSET_VERTICAL = { x: 12, y: 0 };
export const COTE_LABEL_DEFAULT_OFFSET_HORIZONTAL = { x: -12, y: 20 };

// Screen-oriented anchor (page pt, relative to the bar's midpoint) → stored
// outward-positive offset. Inverse of the mapping done below.
export function getCoteLabelOffsetFromAnchor({
  anchorPt,
  isVerticalLike,
  outSign,
}) {
  if (isVerticalLike) return { x: anchorPt.x * outSign.x, y: 0 };
  return { x: anchorPt.x, y: anchorPt.y * outSign.y };
}

export default function getCoteLabelStyleGeometry({
  p1,
  p2,
  offsetPx = 0,
  labelOffset,
  pageScale = 1,
}) {
  if (!p1 || !p2) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;

  const ux = dx / length;
  const uy = dy / length;
  // Canonical perpendicular (90° CW in y-down screen coords) — same as
  // NodeCoteStatic.
  const nx = -uy;
  const ny = ux;

  const D1 = { x: p1.x + nx * offsetPx, y: p1.y + ny * offsetPx };
  const D2 = { x: p2.x + nx * offsetPx, y: p2.y + ny * offsetPx };
  const mid = { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 };

  // Outward direction: from the measured points towards the bar.
  const side = offsetPx >= 0 ? 1 : -1;
  const out = { x: nx * side, y: ny * side };
  const outSign = { x: out.x >= 0 ? 1 : -1, y: out.y >= 0 ? 1 : -1 };

  const isVerticalLike = Math.abs(dy) >= Math.abs(dx);

  const hasStored =
    labelOffset &&
    Number.isFinite(labelOffset.x) &&
    Number.isFinite(labelOffset.y);
  const stored = hasStored
    ? labelOffset
    : isVerticalLike
      ? COTE_LABEL_DEFAULT_OFFSET_VERTICAL
      : COTE_LABEL_DEFAULT_OFFSET_HORIZONTAL;

  const anchorPt = isVerticalLike
    ? { x: outSign.x * stored.x, y: 0 }
    : { x: stored.x, y: outSign.y * stored.y };

  const leaderPointsPt = isVerticalLike
    ? [{ x: 0, y: 0 }, anchorPt]
    : [{ x: 0, y: 0 }, { x: 0, y: anchorPt.y }, anchorPt];

  return {
    u: { x: ux, y: uy },
    out,
    outSign,
    D1,
    D2,
    mid,
    isVerticalLike,
    anchorPt,
    leaderPointsPt,
    textAnchor: anchorPt.x >= 0 ? "start" : "end",
    anchorImagePt: {
      x: mid.x + anchorPt.x * pageScale,
      y: mid.y + anchorPt.y * pageScale,
    },
  };
}
