import { computeMergesForAnnotation } from "Features/annotations/utils/computeJoinAnnotationEnds";
import applyJoinAnnotationMergesService from "Features/annotations/services/applyJoinAnnotationMergesService";

import db from "App/db/db";

// « Segment similaire » with « Fusionner »: a segment just created by Space
// is fused with the walls of the same template and width whose end it
// touches (same rule and persistence as « Joindre » + « Fusionner si
// possible »). The existing wall survives and absorbs the new segment; when
// both ends touch a wall, the three become one.
//
// `created` is the new annotation RESOLVED in pixels (points carry id, x, y);
// `annotations` are the resolved, editable annotations of the base map.
// Returns { mergedCount, survivor } — `survivor` resolved, null when nothing
// was fused.
export default async function mergeCreatedSegmentService({
  created,
  annotations,
  imageSize,
  meterByPx,
  reachPx,
  dispatch,
}) {
  let current = created;
  let others = (annotations || []).filter((a) => a.id !== created.id);
  // Ends of the new segment that may still fuse.
  const pendingEnds = new Set(created.points.map((p) => p.id));
  let mergedCount = 0;

  while (pendingEnds.size) {
    const [merge] = computeMergesForAnnotation({
      annotation: current,
      annotations: others,
      meterByPx,
      reachPx,
      endPointIds: pendingEnds,
    });
    if (!merge) break;
    const result = await applyJoinAnnotationMergesService({
      merges: [merge],
      annotations: [...others, current],
      meterByPx,
      dispatch,
    });
    pendingEnds.delete(merge.keepEndPointId);
    pendingEnds.delete(merge.dropEndPointId);
    if (!result.mergedCount) break;
    mergedCount += 1;

    // The survivor's end vertex may have been forked: read it back.
    const keep =
      merge.keepId === current.id
        ? current
        : others.find((a) => a.id === merge.keepId);
    const row = await db.annotations.get(merge.keepId);
    const refs = (row?.points || []).filter((p) => p?.id);
    const rows = await db.points.bulkGet(refs.map((p) => p.id));
    if (!keep || rows.some((p) => !p)) break;
    current = {
      ...keep,
      points: refs.map((ref, i) => ({
        ...ref,
        x: rows[i].x * imageSize.width,
        y: rows[i].y * imageSize.height,
      })),
    };
    others = others.filter(
      (a) => a.id !== merge.keepId && a.id !== merge.dropId
    );
  }

  return { mergedCount, survivor: mergedCount ? current : null };
}
