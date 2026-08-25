// True PARALLEL offset of an open polyline, with miter joints.
//
// Dependency free (plain {x, y} objects) so it can be replayed in node. Every
// other field of a point ({id, type, offsetBottom, …}) rides along untouched.
//
// Each output segment is exactly parallel to its source segment, at exactly
// `distance` from it. That is the difference with
// `Features/mapEditorGeneric/utils/offsetPointsAlongNormals`, which moves each
// vertex along its NEIGHBOUR-TO-NEIGHBOUR normal: at a corner that direction is
// perpendicular to neither adjacent segment, so the offset chain comes out
// skewed. (That behaviour is deliberate there — on an S-C-S arc triplet the
// neighbour-to-neighbour tangent is the radial direction, which keeps an offset
// arc concentric — so the two functions coexist rather than one replacing the
// other.)
//
// Sign convention is shared with offsetPointsAlongNormals: the normal of a
// segment A→B is the right-of-tangent normal (t.y, -t.x) in y-down screen
// coordinates, so a positive distance offsets to the same side in both.

// Beyond this, a near-180° fold would send the miter point to infinity; the
// joint is clamped instead. 1 = no miter (bevel-ish), large = sharp spikes.
const MITER_LIMIT = 8;

const segmentNormal = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return null;
  return { x: dy / len, y: -dx / len };
};

export default function offsetPolylineParallel(pts, distance) {
  const n = pts?.length ?? 0;
  if (n < 2) return (pts || []).map((p) => ({ ...p }));

  // Normal of each segment i (points[i] → points[i+1]). A degenerate segment
  // inherits its neighbour's so the chain never breaks.
  const normals = [];
  for (let i = 0; i < n - 1; i++) {
    normals.push(segmentNormal(pts[i], pts[i + 1]));
  }
  for (let i = 0; i < normals.length; i++) {
    if (normals[i]) continue;
    normals[i] =
      normals.slice(0, i).reverse().find(Boolean) ??
      normals.slice(i + 1).find(Boolean) ??
      { x: 0, y: 0 };
  }

  return pts.map((p, i) => {
    // Endpoints ride on their single adjacent segment's normal.
    if (i === 0) {
      return {
        ...p,
        x: p.x + normals[0].x * distance,
        y: p.y + normals[0].y * distance,
      };
    }
    if (i === n - 1) {
      const nl = normals[n - 2];
      return { ...p, x: p.x + nl.x * distance, y: p.y + nl.y * distance };
    }

    // Interior joint: the point at `distance` from BOTH offset lines is
    //   P + distance * (n1 + n2) / (1 + n1·n2)
    // — check: ((n1+n2)/(1+n1·n2))·n1 = (1 + n1·n2)/(1 + n1·n2) = 1, and the
    // same for n2, so both offset lines are met exactly. This is what keeps
    // each output segment parallel to its source.
    const n1 = normals[i - 1];
    const n2 = normals[i];
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    if (Math.abs(denom) < 1e-9) {
      // Segments double back on themselves: no finite miter.
      return { ...p, x: p.x + n1.x * distance, y: p.y + n1.y * distance };
    }
    let mx = (n1.x + n2.x) / denom;
    let my = (n1.y + n2.y) / denom;
    const mLen = Math.hypot(mx, my);
    if (mLen > MITER_LIMIT) {
      mx = (mx / mLen) * MITER_LIMIT;
      my = (my / mLen) * MITER_LIMIT;
    }
    return { ...p, x: p.x + mx * distance, y: p.y + my * distance };
  });
}
