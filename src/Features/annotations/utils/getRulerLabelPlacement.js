// Where a RULER value sits relative to the alignment line, and how it is
// anchored. Dependency free (plain {x, y} objects) so it can be replayed in
// node.
//
// Values stay HORIZONTAL whatever the segment direction — they are never
// rotated along the segment — and are anchored against the alignment line on
// the side AWAY from the drawn polyline. A vertical ruler therefore reads as a
// clean right- (or left-) aligned column, which is the whole point.
//
// `P1/P2` are the segment's measured points, `D1/D2` its counterparts on the
// alignment line. All in image-pixel space; the returned x/y are SCREEN px, to
// be applied inside the counter-scaled group.

// Gap between the alignment line and the value sitting against it, screen px.
const LABEL_PAD_PX = 6;

// Unit vector pointing from the drawn polyline towards the alignment line.
export function getRulerOutwardDir({ P1, P2, D1, D2 }) {
  const pMidX = (P1.x + P2.x) / 2;
  const pMidY = (P1.y + P2.y) / 2;
  const ox = (D1.x + D2.x) / 2 - pMidX;
  const oy = (D1.y + D2.y) / 2 - pMidY;
  const l = Math.hypot(ox, oy);
  if (l > 1e-6) return { ox: ox / l, oy: oy / l };
  // Offset 0: there is no outward direction to derive from the geometry —
  // fall back to the segment's right-of-tangent normal so the value still
  // clears the line instead of sitting on it.
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const dl = Math.hypot(dx, dy) || 1;
  return { ox: dy / dl, oy: -dx / dl };
}

export default function getRulerLabelPlacement({
  P1,
  P2,
  D1,
  D2,
  pad = LABEL_PAD_PX,
}) {
  const { ox, oy } = getRulerOutwardDir({ P1, P2, D1, D2 });
  // Which axis the alignment line sits on decides the anchoring: a mostly
  // sideways offset (the vertical-ruler case) anchors start/end so the values
  // line up in a column; a mostly up/down offset centres them instead.
  const horizontal = Math.abs(ox) >= Math.abs(oy);
  return {
    ox,
    oy,
    horizontal,
    textAnchor: horizontal ? (ox > 0 ? "start" : "end") : "middle",
    dominantBaseline: horizontal
      ? "middle"
      : oy > 0
        ? "hanging"
        : "alphabetic",
    x: ox * pad,
    y: oy * pad,
  };
}

// Footprint of the inline length editor, screen px — the field replaces the
// value in place, so it follows the same outward placement (a right-aligned
// value puts its field to the left).
export function getRulerFieldPlacement({ ox, oy, horizontal }, width, height, pad = LABEL_PAD_PX) {
  if (horizontal) {
    return {
      x: ox > 0 ? ox * pad : -(width + pad),
      y: -height / 2,
    };
  }
  return {
    x: -width / 2,
    y: oy > 0 ? oy * pad : -(height + pad),
  };
}
