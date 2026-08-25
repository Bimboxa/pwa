import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Hard cap so a tiny step on a long path can never spawn thousands of nodes.
const MAX_ARROWS = 500;

// Evenly distributed arrow anchors along a (possibly arc-bearing) polyline.
//
// points   : resolved px points (S-C-S arc triplets supported)
// stepPx   : spacing between two arrows, in the same unit as the points
// closeLine: include the closing segment (POLYGON-like rings)
//
// Returns [{ x, y, angleDeg }] — angleDeg is the tangent direction in the SVG
// screen convention (0 = +x, clockwise-positive), pointing "forward" along
// the drawing order. Arrows are CENTRED on the path: n = floor(L / step)
// arrows, the first at (L - (n - 1) * step) / 2. A path shorter than one step
// still gets a single arrow at its middle so its direction stays readable.
export default function getArrowsAlongPolyline({
  points,
  stepPx,
  closeLine = false,
}) {
  if (!Array.isArray(points) || points.length < 2) return [];
  if (!(stepPx > 0)) return [];

  const poly = expandArcsInPath(points, 16, closeLine);
  if (closeLine && poly.length > 1) {
    const first = poly[0];
    const last = poly[poly.length - 1];
    if (first.x !== last.x || first.y !== last.y) poly.push({ ...first });
  }
  if (poly.length < 2) return [];

  // cumulative arc length
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(
      cum[i - 1] +
        Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y)
    );
  }
  const L = cum[cum.length - 1];
  if (!(L > 0)) return [];

  let n = Math.floor(L / stepPx);
  let first;
  if (n < 1) {
    n = 1;
    first = L / 2;
  } else {
    first = (L - (n - 1) * stepPx) / 2;
  }
  n = Math.min(n, MAX_ARROWS);

  const arrows = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const s = first + k * stepPx;
    // advance to the segment containing s (s is monotonic increasing)
    while (seg < poly.length - 1 && cum[seg] < s) seg++;
    const a = poly[seg - 1];
    const b = poly[seg];
    const segLen = cum[seg] - cum[seg - 1];
    const t = segLen > 0 ? (s - cum[seg - 1]) / segLen : 0;
    arrows.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angleDeg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    });
  }
  return arrows;
}
