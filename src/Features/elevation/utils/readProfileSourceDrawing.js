// Relative import with extension so the node test can load this file
// unbundled (segmentFlags.js has no dependency of its own).
import {
  getRingSegmentFlagPointIds,
  segmentPointIdsToIdx,
  getAnnotationRingClosed,
} from "../../annotations/utils/segmentFlags.js";

// Reads a profile SOURCE drawing (an annotation flagged `isProfile`) the way
// applyProfileFromAnnotationService consumes it — shared with the profile
// thumbnails of the « Forme par défaut » menu so what the user sees on the
// tile is exactly what gets swept.
//
// Inputs: the raw source row, its point rows (db.points, aligned on
// `src.points`) and its base map row. Pure (no Dexie) so it can run in node.
//
// Returns null when the drawing is unreadable (no frame, < 2 vertices, every
// segment hidden), else:
//   - pts: every vertex in the source PIXEL frame, with `type`
//     ("circle" = S-C-S arc control, else "square") and `isBasePoint`;
//   - refPt / xRef / yRef: the registration origin — the "Point de référence"
//     vertex (may sit on a hidden spacer segment), else the first vertex's x
//     and the LOWEST vertex's y;
//   - visiblePts: the LONGEST run of consecutive segments not listed in the
//     source's hidden segments (the drawn shape must stay one polyline);
//   - closed: the loop survives only when nothing was hidden;
//   - imageSize / meterByPx of the source base map (meterByPx may be null —
//     unscaled drawings; callers pick their own fallback).
export default function readProfileSourceDrawing({ src, srcRows, srcBaseMap }) {
  if (!src) return null;
  const imageSize = srcBaseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) return null;

  const srcRefs = src.points ?? [];
  const rows = srcRows ?? [];
  const pts = srcRefs
    .map((ref, i) => {
      const p = rows[i];
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
      return {
        x: p.x * imageSize.width,
        y: p.y * imageSize.height,
        type: ref?.type === "circle" ? "circle" : "square",
        isBasePoint: Boolean(ref?.isBasePoint),
      };
    })
    .filter(Boolean);
  if (pts.length < 2) return null;

  const refPt = pts.find((p) => p.isBasePoint) ?? null;
  const xRef = refPt ? refPt.x : pts[0].x;
  const yRef = refPt ? refPt.y : Math.max(...pts.map((p) => p.y));

  // Hidden segments, read id-aware (the raw row may be migrated —
  // segmentFlags.js) and re-keyed against the FILTERED refs so `pts` indices
  // line up even when orphaned refs were dropped.
  const ringClosed = getAnnotationRingClosed(src);
  const keptRefs = srcRefs.filter((ref, i) => {
    const p = rows[i];
    return Number.isFinite(p?.x) && Number.isFinite(p?.y);
  });
  const hiddenIds = getRingSegmentFlagPointIds(
    src,
    "hiddenSegmentsIdx",
    "hiddenSegmentsPointIds",
    srcRefs,
    { closed: ringClosed }
  );
  const hiddenSet = new Set(
    hiddenIds == null
      ? []
      : segmentPointIdsToIdx(hiddenIds, keptRefs, { closed: ringClosed })
  );

  let visiblePts = pts;
  if (hiddenSet.size) {
    const runs = [];
    let run = null;
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (hiddenSet.has(i)) {
        run = null;
        continue;
      }
      if (!run) {
        run = { start: i, end: i + 1, length: 0 };
        runs.push(run);
      }
      run.end = i + 1;
      run.length += Math.hypot(
        pts[i + 1].x - pts[i].x,
        pts[i + 1].y - pts[i].y
      );
    }
    if (!runs.length) return null;
    const best = runs.reduce((a, b) => (b.length > a.length ? b : a));
    visiblePts = pts.slice(best.start, best.end + 1);
  }
  if (visiblePts.length < 2) return null;

  return {
    pts,
    visiblePts,
    refPt,
    xRef,
    yRef,
    // A closed source (circle / closed polyline) stays closed only when
    // nothing was hidden — hiding a segment cuts the loop into an open run.
    closed: Boolean(src.closeLine) && visiblePts === pts,
    imageSize,
    meterByPx: srcBaseMap?.meterByPx || null,
  };
}
