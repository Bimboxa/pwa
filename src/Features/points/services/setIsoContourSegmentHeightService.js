import db from "App/db/db";

// Sets the height (meters, offsetTop semantics — vs the polygon's offsetZ) of
// an iso-flagged contour segment ("Courbe de niveau" checkbox) by writing the
// SAME offsetTop onto both endpoint refs of the segment, so every existing
// offsetTop consumer (3D walls, quantities, elevation profile) picks it up
// with no new field.
//
// Note: two adjacent iso segments share a vertex — the last written height
// wins on the shared point (the expected use is a contiguous chain of iso
// segments at one height).
export default async function setIsoContourSegmentHeightService({
  annotationId,
  cutIdx,
  segIdx,
  height,
}) {
  if (!annotationId || !Number.isInteger(segIdx)) return;
  const ann = await db.annotations.get(annotationId);
  if (!ann) return;

  const h = Number(height) || 0;

  const patchRing = (ring) => {
    const n = ring?.length ?? 0;
    if (n < 2 || segIdx < 0 || segIdx >= n) return null;
    const iA = segIdx;
    const iB = (segIdx + 1) % n;
    return ring.map((p, i) =>
      i === iA || i === iB ? { ...p, offsetTop: h } : p
    );
  };

  if (cutIdx == null) {
    const nextPoints = patchRing(ann.points);
    if (!nextPoints) return;
    await db.annotations.update(annotationId, { points: nextPoints });
  } else {
    const cut = ann.cuts?.[cutIdx];
    const nextCutPoints = patchRing(cut?.points);
    if (!nextCutPoints) return;
    const nextCuts = ann.cuts.map((c, i) =>
      i === cutIdx ? { ...c, points: nextCutPoints } : c
    );
    await db.annotations.update(annotationId, { cuts: nextCuts });
  }
}
