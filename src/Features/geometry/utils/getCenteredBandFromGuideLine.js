// Build a closed band ring CENTERED on a guideLine, by projecting each guideLine
// CONTROL point perpendicular to the line by ±width/2 — WITHOUT discretizing arcs.
//
// Each control point's `type` (square / circle) is carried onto both band edges,
// so a square→circle→square arc on the guideLine is reproduced as a square→circle
// →square arc on each edge of the band (the renderer / 3D builder reconstruct the
// arc from those 3 control points). This keeps the polygon at 2·N points instead
// of densely sampling every arc.
//
// The per-point normal is what makes the cross-section orthogonal to the line.
// We first build a FORWARD TANGENT at every vertex from its adjacent primitives:
//   - straight segment        → the chord (unit) direction
//   - arc (square→circle→square) → the arc's tangent at that vertex (perpendicular
//     to the radius of the fitted circle), oriented along the travel direction
// A vertex shared by two primitives averages the two incoming/outgoing tangents
// (miter). The normal is the tangent rotated +90°, so every cross-section is
// orthogonal to the line — including arc midpoints AND the end caps at endpoints
// reached through an arc (where the chord direction would otherwise skew it).
//
// Input  : controlPts = [{x, y, type?}, ...] (open polyline, pixel space)
//          widthPx     = band width in pixels
// Output : closed ring [{x, y, type}, ...] = leftEdge + reversed rightEdge
//          (no closing duplicate). Empty array when degenerate.

function unit(x, y) {
  const l = Math.hypot(x, y);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

// Circumcenter of the triangle (a, b, c); null when (near-)collinear.
function circumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { x: ux, y: uy };
}

// Arc tangent at point P (on the circle centered at `center`), oriented to the
// same half-plane as the forward reference vector `fwd`.
function arcTangent(P, center, fwd) {
  const r = unit(P.x - center.x, P.y - center.y);
  let t = { x: -r.y, y: r.x }; // radial rotated +90 → tangent
  if (t.x * fwd.x + t.y * fwd.y < 0) t = { x: -t.x, y: -t.y };
  return t;
}

export default function getCenteredBandFromGuideLine(controlPts, widthPx) {
  const n = Array.isArray(controlPts) ? controlPts.length : 0;
  if (n < 2 || !(widthPx > 0)) return [];

  const half = widthPx / 2;

  // Forward tangent contributed by the primitive arriving at / leaving each vertex.
  const inTan = new Array(n).fill(null);
  const outTan = new Array(n).fill(null);

  let i = 0;
  while (i < n - 1) {
    const isArc =
      i + 2 <= n - 1 && controlPts[i + 1]?.type === "circle";
    const center = isArc
      ? circumcenter(controlPts[i], controlPts[i + 1], controlPts[i + 2])
      : null;

    if (isArc && center) {
      const A = controlPts[i];
      const M = controlPts[i + 1];
      const B = controlPts[i + 2];
      outTan[i] = arcTangent(A, center, { x: M.x - A.x, y: M.y - A.y });
      const midT = arcTangent(M, center, { x: B.x - A.x, y: B.y - A.y });
      inTan[i + 1] = midT;
      outTan[i + 1] = midT;
      inTan[i + 2] = arcTangent(B, center, { x: B.x - M.x, y: B.y - M.y });
      i += 2; // the arc end is shared with the next primitive
    } else {
      const A = controlPts[i];
      const B = controlPts[i + 1];
      const d = unit(B.x - A.x, B.y - A.y);
      outTan[i] = d;
      inTan[i + 1] = d;
      i += 1;
    }
  }

  // Per-vertex normal = forward tangent (in + out) rotated +90° → a consistent
  // "left" side, so the band never twists.
  const vertN = [];
  for (let k = 0; k < n; k++) {
    let tx = 0;
    let ty = 0;
    if (inTan[k]) {
      tx += inTan[k].x;
      ty += inTan[k].y;
    }
    if (outTan[k]) {
      tx += outTan[k].x;
      ty += outTan[k].y;
    }
    let t = unit(tx, ty);
    // Fold-back guard: if the two tangents cancel, fall back to either one.
    if (t.x === 0 && t.y === 0) t = inTan[k] || outTan[k] || { x: 1, y: 0 };
    vertN.push({ x: -t.y, y: t.x });
  }

  const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

  const left = controlPts.map((p, k) => ({
    x: p.x + vertN[k].x * half,
    y: p.y + vertN[k].y * half,
    type: typeOf(p),
  }));
  const right = controlPts.map((p, k) => ({
    x: p.x - vertN[k].x * half,
    y: p.y - vertN[k].y * half,
    type: typeOf(p),
  }));

  return [...left, ...right.reverse()];
}
