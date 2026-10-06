import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import {
  SEGMENT_FLAG_FIELDS,
  getRingSegmentFlagPointIds,
} from "Features/annotations/utils/segmentFlags";
import reflowOpeningsForHost from "Features/mapEditor/services/reflowOpeningsForHostService";
import { copyMeshPaintsForSplit } from "Features/meshPaint/services/copyMeshPaintsService";
import getSplitPieceProps from "Features/surfaceCut/utils/getSplitPieceProps";

import isolatePolylineSegment from "../utils/isolatePolylineSegment";
import partitionSegmentFlagIds from "../utils/partitionSegmentFlagIds";

// Why the segment was not isolated (no write).
export const ISOLATE_SEGMENT_REASONS = {
  TYPE: "TYPE", // not a POLYLINE / STRIP
  MESH3D: "MESH3D", // mesh annotation (isMesh3d)
  SUBTRACTION: "SUBTRACTION", // source / target of a subtraction
  NOT_FOUND: "NOT_FOUND", // annotation or segment not found
  ALREADY_ISOLATED: "ALREADY_ISOLATED", // 2-point open polyline
  FAILED: "FAILED",
};

// Fields that reference point ids / segment indices of the ORIGINAL geometry:
// kept on the piece that keeps the annotation, dropped from the new pieces
// (same rule as « Couper une surface »), never shared between annotations.
const KEPT_ONLY_FIELDS = [
  "guideLines",
  "isoHeightLines",
  "profileLines",
  "innerPoints",
  "meshLines",
  "meshLinesBySegment",
];

const PIECE_KEYS = ["before", "isolated", "after"];

// « Isoler un segment » — the POLYLINE / STRIP `annotation` (RAW db row) is
// cut at both ends of the segment starting at `segmentStartPointId` (an
// S-C-S arc is isolated whole). The pieces share the cut vertices (same
// db.points, no new point). The longest remaining piece in plan keeps the
// annotation (id, relations); the isolated segment and the other remaining
// piece (if any) are created with the original's fields (getSplitPieceProps).
// Per-segment flags follow their segment; glued openings are re-hosted on
// the piece carrying their anchor segment, then reflowed; painted parts
// (« Pinceau ») are distributed. One undo group.
//
// imageSize / meterByPx: of the annotation's base map (plan lengths, reflow,
// paints). Returns { status: "done", isolatedId, keptId, newIds } or
// { status: "refused", reason } (ISOLATE_SEGMENT_REASONS).
export default async function isolateSegmentService({
  annotation,
  segmentStartPointId,
  projectId,
  imageSize,
  meterByPx,
  createAnnotationFn,
  updateAnnotationFn,
}) {
  const refused = (reason) => ({ status: "refused", reason });

  if (!annotation) return refused(ISOLATE_SEGMENT_REASONS.NOT_FOUND);
  if (!["POLYLINE", "STRIP"].includes(annotation.type)) {
    return refused(ISOLATE_SEGMENT_REASONS.TYPE);
  }
  if (annotation.isMesh3d) return refused(ISOLATE_SEGMENT_REASONS.MESH3D);

  const rawPoints = annotation.points ?? [];
  const k = rawPoints.findIndex((p) => p?.id === segmentStartPointId);
  if (k < 0) return refused(ISOLATE_SEGMENT_REASONS.NOT_FOUND);

  const closed = annotation.closeLine === true;
  const split = isolatePolylineSegment(rawPoints, k, closed);
  if (!split) return refused(ISOLATE_SEGMENT_REASONS.FAILED);
  if (!split.before && !split.after) {
    return refused(ISOLATE_SEGMENT_REASONS.ALREADY_ISOLATED);
  }
  if (await hasLiveSubtraction(annotation.id)) {
    return refused(ISOLATE_SEGMENT_REASONS.SUBTRACTION);
  }

  const pieces = {
    before: split.before,
    isolated: split.isolated,
    after: split.after,
  };

  // The remaining piece that keeps the annotation: the longest one in plan
  // (a closed ring leaves a single remaining piece).
  const planLength = await buildPlanLengthFn(rawPoints, imageSize);
  let keptKey;
  if (!split.before) keptKey = "after";
  else if (!split.after) keptKey = "before";
  else {
    keptKey =
      planLength(split.after.points) > planLength(split.before.points)
        ? "after"
        : "before";
  }

  // Per-segment flags: materialized as start point ids (legacy index fields
  // cleared — migrate-on-write), then split by segment.
  const flagIdsByField = {};
  const legacyClear = {};
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    const ids = getRingSegmentFlagPointIds(
      annotation,
      idxField,
      idField,
      rawPoints,
      { closed }
    );
    if (annotation[idxField] !== undefined) legacyClear[idxField] = undefined;
    if (ids) flagIdsByField[idField] = ids;
  }
  const flagsByPiece = partitionSegmentFlagIds(
    flagIdsByField,
    rawPoints,
    pieces
  );

  const idByKey = {};
  for (const key of PIECE_KEYS) {
    if (pieces[key]) idByKey[key] = key === keptKey ? annotation.id : nanoid();
  }

  // Glued openings follow the piece carrying their anchor segment.
  const openingRels = (
    await db.relAnnotationOpenings
      .where("hostAnnotationId")
      .equals(annotation.id)
      .toArray()
  ).filter((rel) => !rel.deletedAt);
  const relUpdates = [];
  for (const rel of openingRels) {
    const key = findPieceHostingSegment(pieces, rel);
    if (key && key !== keptKey) {
      relUpdates.push({ id: rel.id, hostAnnotationId: idByKey[key] });
    }
  }

  const kept = pieces[keptKey];
  const keptUpdate = {
    ...annotation,
    ...flagsByPiece[keptKey],
    ...legacyClear,
    points: kept.points,
    closeLine: false,
  };
  if (annotation.meshLinesBySegment) {
    keptUpdate.meshLinesBySegment = remapMeshLinesBySegment(
      annotation.meshLinesBySegment,
      rawPoints,
      kept.points
    );
  }

  const newRows = PIECE_KEYS.filter(
    (key) => key !== keptKey && pieces[key]
  ).map((key) => {
    const props = getSplitPieceProps(annotation);
    for (const field of KEPT_ONLY_FIELDS) delete props[field];
    for (const { idxField } of SEGMENT_FLAG_FIELDS) delete props[idxField];
    return {
      ...props,
      ...flagsByPiece[key],
      id: idByKey[key],
      points: pieces[key].points,
      closeLine: false,
    };
  });
  const newIds = newRows.map((row) => row.id);

  try {
    // One Ctrl+Z undoes the whole isolation (the opening re-hosts are not
    // undoable: rel tables are outside the undo manager — accepted).
    await withUndoGroup(async () => {
      await updateAnnotationFn(keptUpdate);
      for (const row of newRows) await createAnnotationFn(row);
      for (const { id, hostAnnotationId } of relUpdates) {
        await db.relAnnotationOpenings.update(id, { hostAnnotationId });
      }
    });
  } catch (e) {
    console.error("[isolateSegment] write failed", e);
    return refused(ISOLATE_SEGMENT_REASONS.FAILED);
  }

  const metrics =
    imageSize?.width && imageSize?.height && meterByPx > 0
      ? {
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          meterByPx,
        }
      : null;
  try {
    await copyMeshPaintsForSplit({
      sourceHostId: annotation.id,
      newHostIds: newIds,
      metrics,
    });
  } catch (e) {
    console.error("[isolateSegment] mesh paints copy failed", e);
  }
  if (projectId && metrics) {
    try {
      await reflowOpeningsForHost({
        hostIds: [annotation.id, ...newIds],
        projectId,
        imageSize,
        meterByPx,
      });
    } catch (e) {
      console.error("[isolateSegment] openings reflow failed", e);
    }
  }

  return {
    status: "done",
    isolatedId: idByKey.isolated,
    keptId: annotation.id,
    newIds,
  };
}

// A plan split would leave the subtractions the annotation takes part in
// pointing at one piece only (same rule as the 3D « Coupe face »).
async function hasLiveSubtraction(annotationId) {
  const [asSource, asTarget] = await Promise.all([
    db.relAnnotationSubtractions
      .where("sourceAnnotationId")
      .equals(annotationId)
      .toArray(),
    db.relAnnotationSubtractions
      .where("targetAnnotationId")
      .equals(annotationId)
      .toArray(),
  ]);
  return [...asSource, ...asTarget].some((rel) => !rel.deletedAt);
}

// Developed length (px) of a piece from db.points — orphan refs skipped.
async function buildPlanLengthFn(rawPoints, imageSize) {
  const ids = [...new Set(rawPoints.map((p) => p?.id).filter(Boolean))];
  const rows = await db.points.bulkGet(ids);
  const width = imageSize?.width || 1;
  const height = imageSize?.height || 1;
  const pxById = new Map();
  rows.forEach((row, i) => {
    if (row && !row.deletedAt && Number.isFinite(row.x)) {
      pxById.set(ids[i], { x: row.x * width, y: row.y * height });
    }
  });
  return (points) => {
    let length = 0;
    let prev = null;
    for (const ref of points) {
      const px = pxById.get(ref?.id);
      if (!px) continue;
      if (prev) length += Math.hypot(px.x - prev.x, px.y - prev.y);
      prev = px;
    }
    return length;
  };
}

// The piece carrying the opening's anchor segment (hostSegmentStartPointId →
// hostSegmentEndPointId, either direction, with an arc control between the
// two for an arc host) — null when none does.
function findPieceHostingSegment(pieces, rel) {
  const s = rel.hostSegmentStartPointId;
  const e = rel.hostSegmentEndPointId;
  if (!s || !e) return null;
  for (const key of PIECE_KEYS) {
    const points = pieces[key]?.points;
    if (!points) continue;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]?.id;
      const isArc = points[i + 1]?.type === "circle" && i + 2 < points.length;
      const b = points[isArc ? i + 2 : i + 1]?.id;
      if ((a === s && b === e) || (a === e && b === s)) return key;
    }
  }
  return null;
}

// meshLinesBySegment is keyed by segment INDEX: re-key the kept piece's
// entries through the segment start point ids; the other entries are
// dropped with their segments.
function remapMeshLinesBySegment(meshLinesBySegment, rawPoints, keptPoints) {
  const out = {};
  for (const [oldIndex, lines] of Object.entries(meshLinesBySegment || {})) {
    const startId = rawPoints[Number(oldIndex)]?.id;
    if (!startId) continue;
    const newIndex = keptPoints.findIndex((p) => p?.id === startId);
    if (newIndex < 0 || newIndex >= keptPoints.length - 1) continue;
    out[newIndex] = lines;
  }
  return out;
}
