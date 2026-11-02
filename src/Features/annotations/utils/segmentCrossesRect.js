// Segment / axis-aligned rectangle predicates shared by the lasso hit-tests
// and the "Joindre" tool. Pure geometry, alias-import free so it stays usable
// from node tests. `rect` is { x, y, width, height }.

const EPS = 1e-9;

export const makeInRect = (rect) => {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  return (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
};

// Proper / touching segment intersection test (orientation based).
const orient = (a, b, c) => {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (v > EPS) return 1;
  if (v < -EPS) return -1;
  return 0;
};
const onSegment = (a, b, c) =>
  Math.min(a.x, b.x) - EPS <= c.x &&
  c.x <= Math.max(a.x, b.x) + EPS &&
  Math.min(a.y, b.y) - EPS <= c.y &&
  c.y <= Math.max(a.y, b.y) + EPS;
export const segmentsIntersect = (a, b, c, d) => {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
};

export const getRectEdges = (rect) => {
  const tl = { x: rect.x, y: rect.y };
  const tr = { x: rect.x + rect.width, y: rect.y };
  const br = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bl = { x: rect.x, y: rect.y + rect.height };
  return [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ];
};

// (a, b) => true when the segment has an endpoint inside the rectangle or
// crosses / touches one of its edges.
export const makeSegmentCrossesRect = (rect) => {
  const inRect = makeInRect(rect);
  const edges = getRectEdges(rect);
  return (a, b) =>
    inRect(a) ||
    inRect(b) ||
    edges.some(([e0, e1]) => segmentsIntersect(a, b, e0, e1));
};
