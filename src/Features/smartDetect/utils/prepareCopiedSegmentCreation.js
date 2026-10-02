import detectCopiedSegmentAtCursor from "./detectCopiedSegmentAtCursor.js";
import detectExactCopyAtCursor from "./detectExactCopyAtCursor.js";
import { computeMergesForAnnotation } from "../../annotations/utils/computeJoinAnnotationEnds.js";
import repairOrthoJunctions, {
  buildJunctionNeighbors,
} from "./repairOrthoJunctions.js";
import getAnnotationStrokeWidthPx from "../../geometry/utils/getAnnotationStrokeWidthPx.js";

export function isCopiedSegment(clipboard) {
  const item = clipboard?.items?.[0];
  return (
    clipboard?.items?.length === 1 &&
    ["STRIP", "POLYLINE"].includes(item?.annotation?.type) &&
    !item.annotation.closeLine &&
    item.basePoints?.length === 2 &&
    item.basePoints.every((p) => p.type !== "circle")
  );
}

// Join only nearby straight segments. Endpoints slide along their own axes;
// unrelated annotations sharing a point id will not be moved at persistence.
export function joinCopiedSegment({
  match,
  annotation,
  annotations,
  meterByPx,
  canEditAnnotation = () => false,
}) {
  const width = Math.abs(getAnnotationStrokeWidthPx(annotation, meterByPx));
  const orientation = annotation.stripOrientation ?? 1;
  const band =
    annotation.type === "STRIP"
      ? {
          lo: Math.min(0, orientation * width),
          hi: Math.max(0, orientation * width),
        }
      : { lo: -width / 2, hi: width / 2 };
  const neighbors = buildJunctionNeighbors(
    annotations.filter(
      (ann) =>
        !ann.deletedAt &&
        !ann.closeLine &&
        !ann.hiddenSegmentsIdx?.length &&
        !ann.points?.some((p) => p.type === "circle")
    ),
    meterByPx
  ).map((neighbor) => ({
    ...neighbor,
    pointIds: canEditAnnotation(neighbor.id) ? neighbor.pointIds : null,
  }));
  const maxGapPx = meterByPx > 0 ? 0.14 / meterByPx : Math.min(12, width * 0.7);
  const overlapPx =
    meterByPx > 0 ? 0.01 / meterByPx : Math.min(1, width * 0.05);
  // Two collinear segments are the same wall when their axes are within
  // 1 cm, never less than the raster resolves.
  const alignPx = Math.max(0.75, meterByPx > 0 ? 0.01 / meterByPx : 0);
  const [q1, q2] = match.placedPoints;
  const repaired = repairOrthoJunctions({
    q1,
    q2,
    band,
    neighbors,
    maxGapPx,
    overlapPx,
  });
  const length = Math.hypot(q2.x - q1.x, q2.y - q1.y);
  const u = { x: (q2.x - q1.x) / length, y: (q2.y - q1.y) / length };
  const n = { x: -u.y, y: u.x };
  const candidateMid = (band.lo + band.hi) / 2;
  // Collinear neighbors close small end-to-end gaps without merging records.
  for (const [key, sign, original] of [
    ["q1", -1, q1],
    ["q2", 1, q2],
  ]) {
    if (
      Math.hypot(repaired[key].x - original.x, repaired[key].y - original.y) >
      1e-6
    )
      continue;
    let best = null;
    for (const nb of neighbors) {
      const nbLength = Math.hypot(nb.p2.x - nb.p1.x, nb.p2.y - nb.p1.y);
      if (!nbLength) continue;
      const v = {
        x: (nb.p2.x - nb.p1.x) / nbLength,
        y: (nb.p2.y - nb.p1.y) / nbLength,
      };
      const dot = u.x * v.x + u.y * v.y;
      if (
        Math.abs(dot) < 0.9999 ||
        Math.abs(nb.band.hi - nb.band.lo - width) > Math.max(1, width * 0.1)
      )
        continue;
      const otherMid = (nb.band.lo + nb.band.hi) / 2;
      const centerOffset =
        (nb.p1.x - q1.x) * n.x +
        (nb.p1.y - q1.y) * n.y +
        otherMid * dot -
        candidateMid;
      if (Math.abs(centerOffset) > alignPx) continue;
      const along = [nb.p1, nb.p2].map(
        (p) => sign * ((p.x - original.x) * u.x + (p.y - original.y) * u.y)
      );
      const gap = Math.min(...along);
      if (gap < 0 || gap > maxGapPx || (best !== null && gap >= best)) continue;
      best = gap;
    }
    if (best !== null)
      repaired[key] = {
        x: original.x + sign * best * u.x,
        y: original.y + sign * best * u.y,
      };
  }
  if (
    (repaired.q2.x - repaired.q1.x) * u.x +
      (repaired.q2.y - repaired.q1.y) * u.y <=
    0
  )
    return { match, junctionEdits: [] };
  const placedPoints = [repaired.q1, repaired.q2];
  const points = [
    ...placedPoints.map((p) => ({
      x: p.x + band.lo * n.x,
      y: p.y + band.lo * n.y,
    })),
    ...[...placedPoints]
      .reverse()
      .map((p) => ({ x: p.x + band.hi * n.x, y: p.y + band.hi * n.y })),
  ];
  const junctionEdits = repaired.neighborEdits.map((edit) => {
    const neighbor = neighbors.find((nb) => nb.id === edit.annotationId);
    const before =
      neighbor?.pointIds?.[0] === edit.pointId ? neighbor.p1 : neighbor?.p2;
    return { ...edit, before };
  });
  return {
    match: {
      ...match,
      placedPoints,
      polylines: [{ points, closed: true }],
      targetCenter: {
        x: (repaired.q1.x + repaired.q2.x) / 2 + candidateMid * n.x,
        y: (repaired.q1.y + repaired.q2.y) / 2 + candidateMid * n.y,
      },
    },
    junctionEdits,
  };
}

// How far from an end of the new segment the end of another wall may be for
// the two to be fused: the junction gap (14 cm) plus the corner of two bands.
export function getSegmentMergeReachPx(annotation, meterByPx) {
  if (!(meterByPx > 0)) return 0;
  return (
    0.14 / meterByPx +
    1.5 * Math.abs(getAnnotationStrokeWidthPx(annotation, meterByPx))
  );
}

// Walls the detected segment would be fused with (« Fusionner »): same
// template and width, one end in contact. Only editable walls qualify.
function findMergePartnerIds({
  match,
  annotation,
  annotations,
  meterByPx,
  canEditAnnotation = () => false,
}) {
  const id = "__segment__";
  return computeMergesForAnnotation({
    annotation: {
      ...annotation,
      id,
      points: match.placedPoints.map((p, i) => ({ ...p, id: `${id}:${i}` })),
    },
    annotations: annotations.filter(
      (ann) => !ann.deletedAt && canEditAnnotation(ann.id)
    ),
    meterByPx,
    reachPx: getSegmentMergeReachPx(annotation, meterByPx),
  }).map((merge) => (merge.keepId === id ? merge.dropId : merge.keepId));
}

// The detector acquires a band, centers it and extends it from the cursor —
// or, with `exactCopy`, places the copy unchanged on its pixel signature.
// Join the completed draft before any persistent write, so failure is atomic.
// With `merge`, the walls the segment will be fused with are left out of the
// junction repair: the fusion places their common vertex.
// Returns { match, junctionEdits, mergePartnerIds } or { match: null, reason }.
export default function prepareCopiedSegmentCreation({
  annotations = [],
  canEditAnnotation,
  exactCopy = false,
  merge = false,
  ...options
}) {
  if (!isCopiedSegment(options.clipboard))
    return { match: null, reason: "UNSUPPORTED_REFERENCE" };
  const annotation = options.clipboard.items[0].annotation;
  const searchRadiusImgPx =
    (2 * Math.abs(getAnnotationStrokeWidthPx(annotation, options.meterByPx))) /
    (options.imageScale || 1);
  const detection = (
    exactCopy ? detectExactCopyAtCursor : detectCopiedSegmentAtCursor
  )({ ...options, searchRadiusImgPx });
  if (!detection.match) return detection;
  const mergePartnerIds = merge
    ? findMergePartnerIds({
        match: detection.match,
        annotation,
        annotations,
        meterByPx: options.meterByPx,
        canEditAnnotation,
      })
    : [];
  // An exact copy keeps its length: no endpoint slides to a neighbor.
  if (exactCopy)
    return {
      match: detection.match,
      junctionEdits: [],
      mergePartnerIds,
      trace: detection.trace,
    };
  return {
    ...joinCopiedSegment({
      match: detection.match,
      annotation,
      annotations: annotations.filter(
        (ann) => !mergePartnerIds.includes(ann.id)
      ),
      meterByPx: options.meterByPx,
      canEditAnnotation,
    }),
    mergePartnerIds,
    trace: detection.trace,
  };
}
