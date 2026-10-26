import findOverlappingAnnotations from "Features/duplicatesDetection/utils/findOverlappingAnnotations";
import serializeAnnotationsForDetection from "Features/duplicatesDetection/utils/serializeAnnotationsForDetection";
import {
  DEFAULT_TOLERANCE_CM,
  MIN_OVERLAP_M,
  MIN_OVERLAP_PX,
  MIN_THRESHOLD_PX,
  TOLERANCE_PX_FALLBACK,
} from "Features/duplicatesDetection/constants/duplicatesDetectionConstants";

// « Pinceau » → 2D annotation, duplicate guard: does an annotation of the
// SAME template and type already sit where the candidate would be created?
// "Same place" is the « Détection des doublons » criterion
// (findOverlappingAnnotations, default tolerance): lines / strips when their
// paths run together over more than the minimum overlap, polygons when their
// surfaces intersect. Pixel space, like the detection.
//
// candidate: { type, annotationTemplateId, closeLine, points, cuts } with
//   pixel points (the resolved-annotation shape, no id needed);
// annotations: resolved (pixel) live annotations of the same base map — the
//   helper keeps the ones of the candidate's template and type;
// meterByPx: the base map scale (null → pixel fallback tolerances).
//
// Returns the id of the first existing annotation found at the same place,
// or null.

export const CANDIDATE_ID = "__meshBrushCandidate__";

export function getSamePlaceThresholds(meterByPx) {
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const thresholdPx = Math.max(
    MIN_THRESHOLD_PX,
    hasScale ? DEFAULT_TOLERANCE_CM / 100 / meterByPx : TOLERANCE_PX_FALLBACK
  );
  const minOverlapPx = Math.max(
    2 * thresholdPx,
    hasScale ? MIN_OVERLAP_M / meterByPx : MIN_OVERLAP_PX
  );
  return { thresholdPx, minOverlapPx };
}

export default function findSamePlaceAnnotation({
  candidate,
  annotations,
  meterByPx = null,
}) {
  if (!candidate?.annotationTemplateId || !candidate.type) return null;
  const minPoints = candidate.type === "POLYGON" ? 3 : 2;
  if (!(candidate.points?.length >= minPoints)) return null;

  const existing = (annotations ?? []).filter(
    (a) =>
      a?.id &&
      a.id !== CANDIDATE_ID &&
      a.type === candidate.type &&
      a.annotationTemplateId === candidate.annotationTemplateId &&
      a.points?.length >= minPoints
  );
  if (!existing.length) return null;

  const serialized = serializeAnnotationsForDetection([
    { ...candidate, id: CANDIDATE_ID },
    ...existing,
  ]);
  const { pairs } = findOverlappingAnnotations(
    serialized,
    getSamePlaceThresholds(meterByPx)
  );
  for (const pair of pairs ?? []) {
    if (pair.aId === CANDIDATE_ID) return pair.bId;
    if (pair.bId === CANDIDATE_ID) return pair.aId;
  }
  return null;
}
