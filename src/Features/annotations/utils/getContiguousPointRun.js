// Locate the single ring (main contour or one cut ring) holding ALL the given
// point ids and validate that they form one contiguous run along that ring.
//
// Closed rings (POLYGON main contour, polyline with `closeLine`, every cut)
// allow the run to wrap around the seam (e.g. indices [N-2, N-1, 0, 1]).
//
// Returns:
//   { valid: false }                                     — ids missing, spanning
//     several rings, < 3 points, or non-contiguous
//   { valid: true, ringKey, isClosed, coversRing,
//     indices,   // ring indices in traversal order (wraparound re-ordered)
//     runRefs,   // matching point refs, same order
//     wraps }    // true when the run crosses the ring seam
//
// ringKey is "MAIN" or "CUT::{cutIdx}" (same convention as
// getContiguousSegmentChain).
export default function getContiguousPointRun(annotation, pointIds) {
  if (!annotation || !Array.isArray(pointIds)) return { valid: false };

  const idSet = new Set(pointIds.filter(Boolean));
  if (idSet.size < 3) return { valid: false };

  const rings = [
    {
      ringKey: "MAIN",
      points: annotation.points || [],
      isClosed: annotation.type === "POLYGON" || annotation.closeLine === true,
    },
    ...(annotation.cuts || []).map((c, i) => ({
      ringKey: `CUT::${i}`,
      points: c?.points || [],
      isClosed: true, // cuts are always closed rings
    })),
  ];

  // The run must live on exactly one ring, and every id must be found there.
  // Match by id SET (not ref count): rings may hold duplicated consecutive
  // refs (same point id twice), which must not invalidate the selection.
  let target = null;
  for (const ring of rings) {
    const ringIds = new Set(ring.points.map((p) => p?.id));
    if (![...idSet].some((id) => ringIds.has(id))) continue;
    if (target) return { valid: false }; // ids span several rings
    if (![...idSet].every((id) => ringIds.has(id))) return { valid: false };
    target = ring;
  }
  if (!target) return { valid: false };

  const { ringKey, points, isClosed } = target;
  const N = points.length;
  const indices = [];
  points.forEach((p, i) => {
    if (p && idSet.has(p.id)) indices.push(i);
  });
  const count = indices.length;

  if (isClosed && count === N) {
    return {
      valid: true,
      ringKey,
      isClosed,
      coversRing: true,
      indices,
      runRefs: points.slice(),
      wraps: false,
    };
  }

  // Contiguity on the sorted (ascending) indices.
  const breaks = [];
  for (let i = 1; i < count; i++) {
    if (indices[i] !== indices[i - 1] + 1) breaks.push(i);
  }

  if (breaks.length === 0) {
    return {
      valid: true,
      ringKey,
      isClosed,
      coversRing: false,
      indices,
      runRefs: indices.map((i) => points[i]),
      wraps: false,
    };
  }

  // Single break touching both ends of a closed ring → wraparound run.
  if (
    isClosed &&
    breaks.length === 1 &&
    indices[0] === 0 &&
    indices[count - 1] === N - 1
  ) {
    const b = breaks[0];
    const ordered = [...indices.slice(b), ...indices.slice(0, b)];
    return {
      valid: true,
      ringKey,
      isClosed,
      coversRing: false,
      indices: ordered,
      runRefs: ordered.map((i) => points[i]),
      wraps: true,
    };
  }

  return { valid: false };
}
