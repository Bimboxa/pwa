import detectWallHoverCandidate from "./detectWallHoverCandidate.js";
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
      if (Math.abs(centerOffset) > 0.75) continue;
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

// The detector acquires a band, instantiates a segment draft and extends it.
// Join the completed draft before any persistent write, so failure is atomic.
export default function prepareCopiedSegmentCreation({
  annotations = [],
  canEditAnnotation,
  ...options
}) {
  if (!isCopiedSegment(options.clipboard)) return null;
  const annotation = options.clipboard.items[0].annotation;
  const searchRadiusImgPx =
    (2 * Math.abs(getAnnotationStrokeWidthPx(annotation, options.meterByPx))) /
    (options.imageScale || 1);
  const match = detectWallHoverCandidate({ ...options, searchRadiusImgPx })
    ?.matches?.[0];
  if (!match) return null;
  return joinCopiedSegment({
    match,
    annotation: options.clipboard.items[0].annotation,
    annotations,
    meterByPx: options.meterByPx,
    canEditAnnotation,
  });
}
