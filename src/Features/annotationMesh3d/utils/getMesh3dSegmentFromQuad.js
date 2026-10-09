// The segment a thin quad stands for: the plan projection of a mesh with no
// plan area (`mesh3dPlanIsSegment`, see projectMesh3dToRings.buildThinQuad)
// is a 4-point quad around the projected segment, MIN_PROJECTION_WIDTH_M
// wide. Returns the midpoints of its two short (opposite) sides, in the
// quad's own coordinates and order — [{x, y}, {x, y}] — or null when the
// points are not a quad. Works after any affine transform of the quad (its
// vertex order is kept, the short sides stay the two shortest edges).
export default function getMesh3dSegmentFromQuad(points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  if (points.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y)))
    return null;

  const edgeLength = (i) => {
    const a = points[i];
    const b = points[(i + 1) % 4];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  // Opposite edge pairs: (0, 2) and (1, 3). The short sides are the pair
  // with the smaller total length.
  const pairA = edgeLength(0) + edgeLength(2);
  const pairB = edgeLength(1) + edgeLength(3);
  const first = pairA <= pairB ? 0 : 1;

  const midpoint = (i) => {
    const a = points[i];
    const b = points[(i + 1) % 4];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  return [midpoint(first), midpoint(first + 2)];
}
