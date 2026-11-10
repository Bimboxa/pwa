// Resolves a RAW db.annotations row into the shape createAnnotationObject3D
// builds from — the geometric part of what useAnnotationsV2 does, outside
// React: points (and cuts, inner points) in pixels of the base map, the
// id-keyed per-segment flags turned into index arrays, the profile lines
// resolved with their inline heights, the height cuts resolved and their
// faces derived (`heightFaces`, never stored). Template-driven display
// fields are NOT merged (the 3D build reads the row's own height / offsetZ /
// colors).
//
// Used by services that build a host's 3D object headlessly from the
// database (procedure-driven metering).
//
// Pure, node-testable.

import resolvePoints from "./resolvePoints";
import resolveCuts from "./resolveCuts";
import resolveProfileLine from "./resolveProfileLine";
import resolveHeightCuts from "../../heightCuts/utils/resolveHeightCuts";
import computeHeightFaces from "../../heightCuts/utils/computeHeightFaces";
import {
  SEGMENT_FLAG_FIELDS,
  getAnnotationRingClosed,
  getRingSegmentFlagPointIds,
  hasAnySegmentFlagField,
  segmentPointIdsToIdx,
} from "./segmentFlags";

const hasXY = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

function resolveRingFlags(target, raw, refs, resolvedPoints, closed) {
  if (!hasAnySegmentFlagField(raw)) return;
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    const ids = getRingSegmentFlagPointIds(raw, idxField, idField, refs, {
      closed,
    });
    if (ids == null) continue;
    target[idField] = ids;
    target[idxField] = segmentPointIdsToIdx(ids, resolvedPoints, { closed });
  }
}

/**
 * @param {object} args
 * @param {object} args.row raw db.annotations row
 * @param {Object<string, {x:number, y:number}>} args.pointsIndex db.points
 *   rows of the row's base map, by id (normalized coordinates)
 * @param {{width:number, height:number}} args.imageSize base map image size
 * @param {number} [args.meterByPx] base map scale (metric tolerances of the
 *   height faces)
 * @returns {object} the row with pixel geometry (null when it has no
 *   resolvable points)
 */
export default function resolveAnnotationRowForBuild({
  row,
  pointsIndex,
  imageSize,
  meterByPx,
}) {
  if (!row || !pointsIndex || !imageSize?.width || !imageSize?.height) {
    return null;
  }
  const closed = getAnnotationRingClosed(row);
  const points = (
    resolvePoints({ points: row.points ?? [], pointsIndex, imageSize }) ?? []
  ).filter(hasXY);
  if (points.length < 2) return null;

  const resolved = { ...row, points };
  resolveRingFlags(resolved, row, row.points ?? [], points, closed);

  if (Array.isArray(row.cuts) && row.cuts.length) {
    const cuts = resolveCuts({ cuts: row.cuts, pointsIndex, imageSize }) ?? [];
    resolved.cuts = cuts
      .map((cut, i) => {
        const cutPoints = (cut.points ?? []).filter(hasXY);
        const next = { ...cut, points: cutPoints };
        resolveRingFlags(
          next,
          row.cuts[i],
          row.cuts[i]?.points ?? [],
          cutPoints,
          true
        );
        return next;
      })
      .filter((cut) => cut.points.length >= 3);
  }

  if (Array.isArray(row.innerPoints) && row.innerPoints.length) {
    resolved.innerPoints = (
      resolvePoints({ points: row.innerPoints, pointsIndex, imageSize }) ?? []
    ).filter(hasXY);
  }

  if (Array.isArray(row.profileLines)) {
    resolved.profileLines = row.profileLines.map((line) => ({
      ...line,
      points: (
        resolveProfileLine({
          profileLine: line?.points,
          pointsIndex,
          imageSize,
        }) ?? []
      ).filter(hasXY),
    }));
  }

  // height cuts (traces + face seeds) and the faces they delimit — same
  // derivation as useAnnotationsV2
  if (row.heightCuts?.length && row.type === "POLYGON") {
    const heightCuts = resolveHeightCuts({
      heightCuts: row.heightCuts,
      heightCutFaces: row.heightCutFaces,
      pointsIndex,
      imageSize,
    });
    resolved.heightCuts = heightCuts.traces;
    resolved.heightCutFaces = heightCuts.faceEntries;
    resolved.heightFaces = row.isMesh3d
      ? []
      : computeHeightFaces({
          contour: resolved.points,
          holes: (resolved.cuts ?? []).map((cut) => cut.points),
          traces: heightCuts.traces,
          faceEntries: heightCuts.faceEntries,
          scale: meterByPx > 0 ? meterByPx : 1,
        });
  }

  return resolved;
}
