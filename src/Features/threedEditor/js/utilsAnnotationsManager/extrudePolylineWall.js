import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Group,
  Line,
  LineLoop,
  LineBasicMaterial,
  EdgesGeometry,
  LineSegments,
  DoubleSide,
} from "three";

import extractPlanarSketchEdges from "../postfx/extractPlanarSketchEdges.js";

const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

// Edge lines of the wall mesh. The quads are independent (no shared vertices
// between adjacent segments), so EdgesGeometry treats every quad border as a
// boundary edge and draws vertical seams across coplanar faces (arc samples,
// stairs subdivisions, opening splits). Coalescing coplanar faces keeps only
// the true outline of each planar cluster; the corner edge shared by two
// clusters comes out once per cluster, so identical segments are deduped to
// keep the original stroke opacity. Falls back to EdgesGeometry when the
// extraction is unusable.
function buildWallEdges(geom) {
  const positions = extractPlanarSketchEdges(geom);
  if (!positions?.length) {
    return new LineSegments(new EdgesGeometry(geom), EDGE_MATERIAL);
  }
  const deduped = [];
  const seen = new Set();
  const q = (v) => Math.round(v * 1e4);
  for (let i = 0; i + 5 < positions.length; i += 6) {
    const a = `${q(positions[i])},${q(positions[i + 1])},${q(positions[i + 2])}`;
    const b = `${q(positions[i + 3])},${q(positions[i + 4])},${q(positions[i + 5])}`;
    const key = a <= b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let k = 0; k < 6; k++) deduped.push(positions[i + k]);
  }
  const edgeGeom = new BufferGeometry();
  edgeGeom.setAttribute("position", new Float32BufferAttribute(deduped, 3));
  return new LineSegments(edgeGeom, EDGE_MATERIAL);
}

// Span (top_z - bottom_z) at a single corner. With the new convention the
// wall top stays fixed at (verticalLift + height + offsetTop): only the bottom
// rises with offsetBottom. A negative span means the local "wall" has its top
// below its bottom — non-physical, so the segment is split / hidden there.
function cornerSpan(p, height) {
  return (height ?? 0) + (p?.offsetTop ?? 0) - (p?.offsetBottom ?? 0);
}

// Linear interpolation of a polyline corner (x, y + per-vertex offsets) at
// parameter t ∈ [0, 1] between two adjacent corners a → b.
function lerpCorner(a, b, t) {
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    offsetBottom:
      (a.offsetBottom ?? 0) +
      t * ((b.offsetBottom ?? 0) - (a.offsetBottom ?? 0)),
    offsetTop:
      (a.offsetTop ?? 0) + t * ((b.offsetTop ?? 0) - (a.offsetTop ?? 0)),
  };
}

// Classifies one wall segment (corner a → corner b) under the new "top stays
// fixed" convention, and returns 0, 1 or 2 visible sub-segments that should
// be extruded. Negative-span portions (where the top would render below the
// bottom) are dropped — they are the "hidden" parts of the wall.
//
//   - both spans >= 0 → keep the segment as-is
//   - both spans < 0  → drop the whole segment
//   - mixed signs     → split at t where span = 0; keep the positive side
function visibleSubSegments(a, b, height) {
  const sa = cornerSpan(a, height);
  const sb = cornerSpan(b, height);
  const aOk = sa >= 0;
  const bOk = sb >= 0;
  if (aOk && bOk) return [[a, b]];
  if (!aOk && !bOk) return [];
  // span(t) = sa + t * (sb - sa) = 0 ⇒ t = sa / (sa - sb)
  const denom = sa - sb;
  if (Math.abs(denom) < 1e-12) return [];
  const t = sa / denom;
  // In the mixed case the zero crossing is mathematically in [0, 1]. A value
  // at (or numerically past) an endpoint means the positive-span region
  // collapses to a single point — there is no visible wall here, so drop the
  // segment. Returning the full [[a, b]] would extrude the negative-span end
  // and produce an inverted triangle at the wall's taper point.
  if (!Number.isFinite(t) || t <= 0 || t >= 1) {
    return [];
  }
  const mid = lerpCorner(a, b, t);
  return aOk ? [[a, mid]] : [[mid, b]];
}

export default function extrudePolylineWall(
  points,
  height,
  material,
  closeLine,
  verticalLift = 0,
  hiddenSegmentsIdx = null
) {
  if (!points || points.length < 2) return null;
  const group = new Group();
  const hiddenSet = hiddenSegmentsIdx ? new Set(hiddenSegmentsIdx) : null;

  // A POLYLINE can define a wall either through a global `height` or purely
  // through per-vertex offsets (slope walls: height=0, span = offsetTop -
  // offsetBottom). Only fall back to the flat-line rendering when there is no
  // vertical extent at all to extrude — otherwise the mesh path below builds
  // the wall and hides the negative-span portions via visibleSubSegments.
  const hasVerticalSpan = points.some((p) => cornerSpan(p, height) > 1e-9);

  // Non-extruded fallback: a flat polyline at each point's bottom z. We do
  // NOT apply the sign-split logic here — without a span there is no
  // "negative span" to hide.
  if ((!height || height <= 0) && !hasVerticalSpan) {
    const bottoms = points.map((p) => verticalLift + (p?.offsetBottom ?? 0));
    const positions = [];
    points.forEach((p, i) => positions.push(p.x, p.y, bottoms[i]));
    const geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const lineMat = new LineBasicMaterial({ color: material.color });
    group.add(
      closeLine ? new LineLoop(geom, lineMat) : new Line(geom, lineMat)
    );
    return group;
  }

  const segmentCount = closeLine ? points.length : points.length - 1;
  const positions = [];
  const indices = [];
  let v = 0;
  for (let i = 0; i < segmentCount; i++) {
    if (hiddenSet?.has(i)) continue;
    const j = (i + 1) % points.length;
    const subs = visibleSubSegments(points[i], points[j], height);
    for (const [a, b] of subs) {
      const aBottom = verticalLift + (a.offsetBottom ?? 0);
      const bBottom = verticalLift + (b.offsetBottom ?? 0);
      const aTop = verticalLift + height + (a.offsetTop ?? 0);
      const bTop = verticalLift + height + (b.offsetTop ?? 0);
      positions.push(a.x, a.y, aBottom);
      positions.push(b.x, b.y, bBottom);
      positions.push(b.x, b.y, bTop);
      positions.push(a.x, a.y, aTop);
      indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }

  if (indices.length === 0) {
    // All segments hidden — nothing to render.
    return group;
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const wallMat = material.clone();
  wallMat.side = DoubleSide;
  group.add(new Mesh(geom, wallMat));

  group.add(buildWallEdges(geom));

  return group;
}
