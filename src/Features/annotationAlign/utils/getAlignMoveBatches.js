import getTransformedPointRefs from "../../mapEditor/utils/getTransformedPointRefs.js";

// Deltas closer than this (px) are the same move.
const DELTA_KEY_PRECISION = 1e4;

function getDeltaKey({ x, y }) {
  return `${Math.round(x * DELTA_KEY_PRECISION)}|${Math.round(y * DELTA_KEY_PRECISION)}`;
}

// Splits the annotations to move into batches each written by ONE commit
// (commitAnnotationsTransform2d, per-annotation MOVE). A commit holds one new
// position per point, so two annotations sharing a point they move by
// different translations never land in the same batch: the first one written
// forks the shared point, the next batch moves the other one.
// Independent annotations (the usual case) make a single batch.
//
// annotations: resolved annotations; deltas: Map<annotationId, {x, y}> (px).
// Returns Array<string[]> (annotation ids, in `deltas` order).
//
// Pure: node-testable.
export default function getAlignMoveBatches({ annotations, deltas }) {
  const annotationById = new Map(
    (annotations ?? []).filter(Boolean).map((a) => [a.id, a])
  );
  // One entry per batch: its ids + the move each of its points follows.
  const batches = [];

  deltas?.forEach((deltaPx, annotationId) => {
    const deltaKey = getDeltaKey(deltaPx);
    const pointIds = getTransformedPointRefs(
      annotationById.get(annotationId)
    ).map((ref) => ref.id);

    let batch = batches.find((candidate) =>
      pointIds.every((pointId) => {
        const key = candidate.deltaKeyByPointId.get(pointId);
        return key === undefined || key === deltaKey;
      })
    );
    if (!batch) {
      batch = { annotationIds: [], deltaKeyByPointId: new Map() };
      batches.push(batch);
    }
    batch.annotationIds.push(annotationId);
    pointIds.forEach((pointId) =>
      batch.deltaKeyByPointId.set(pointId, deltaKey)
    );
  });

  return batches.map((batch) => batch.annotationIds);
}
