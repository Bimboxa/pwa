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

const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

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
  if (!Number.isFinite(t) || t <= 0 || t >= 1) {
    return aOk ? [[a, b]] : [];
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

  // Non-extruded fallback: a flat polyline at each point's bottom z. We do
  // NOT apply the sign-split logic here — without a height there is no
  // "negative span" to hide.
  if (!height || height <= 0) {
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

  group.add(new LineSegments(new EdgesGeometry(geom), EDGE_MATERIAL));

  return group;
}
