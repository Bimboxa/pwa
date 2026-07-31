// Remap helpers for annotation duplication. Given an old-id -> new-id map,
// they rewrite every reference an annotation copy holds so it points at the
// duplicated records instead of the sources. Shared by layer duplication
// (useCreateLayer) and scope duplication (duplicateScopeService) so both flows
// cover the exact same reference fields.

import { SEGMENT_FLAG_FIELDS } from "Features/annotations/utils/segmentFlags";

// Segment flags (hidden / iso / ext / int) are persisted as start-point-id
// arrays on the annotation root and on each cut ring — they must follow the
// point remap or the copy silently loses its flags (id arrays win over the
// legacy idx fields at read time).
function remapSegmentFlagIds(ringHolder, pointIdMap) {
  const remapped = {};
  for (const { idField } of SEGMENT_FLAG_FIELDS) {
    if (Array.isArray(ringHolder[idField])) {
      remapped[idField] = ringHolder[idField].map(
        (pid) => pointIdMap[pid] ?? pid
      );
    }
  }
  return remapped;
}

export function remapPointIds(annotation, pointIdMap) {
  if (Array.isArray(annotation.points)) {
    annotation.points = annotation.points.map((pt) =>
      pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
    );
  }
  if (Array.isArray(annotation.innerPoints)) {
    annotation.innerPoints = annotation.innerPoints.map((pt) =>
      pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
    );
  }
  if (Array.isArray(annotation.cuts)) {
    annotation.cuts = annotation.cuts.map((cut) => ({
      ...cut,
      ...remapSegmentFlagIds(cut, pointIdMap),
      points: Array.isArray(cut.points)
        ? cut.points.map((pt) =>
            pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
          )
        : cut.points,
    }));
  }
  Object.assign(annotation, remapSegmentFlagIds(annotation, pointIdMap));
  if (Array.isArray(annotation.guideLines)) {
    annotation.guideLines = annotation.guideLines.map((g) => ({
      ...g,
      points: Array.isArray(g.points)
        ? g.points.map((ref) =>
            ref?.pointId && pointIdMap[ref.pointId]
              ? { ...ref, pointId: pointIdMap[ref.pointId] }
              : ref
          )
        : g.points,
    }));
  }
  if (Array.isArray(annotation.isoHeightLines)) {
    annotation.isoHeightLines = annotation.isoHeightLines.map((l) => ({
      ...l,
      points: Array.isArray(l.points)
        ? l.points.map((ref) =>
            ref?.pointId && pointIdMap[ref.pointId]
              ? { ...ref, pointId: pointIdMap[ref.pointId] }
              : ref
          )
        : l.points,
    }));
  }
  if (Array.isArray(annotation.profileLines)) {
    annotation.profileLines = annotation.profileLines.map((l) => ({
      ...l,
      points: Array.isArray(l.points)
        ? l.points.map((ref) =>
            ref?.pointId && pointIdMap[ref.pointId]
              ? { ...ref, pointId: pointIdMap[ref.pointId] }
              : ref
          )
        : l.points,
    }));
  }
  if (annotation.point?.id && pointIdMap[annotation.point.id]) {
    annotation.point = {
      ...annotation.point,
      id: pointIdMap[annotation.point.id],
    };
  }
}

export function remapAnnotationIds(annotation, annotationIdMap) {
  if (Array.isArray(annotation.cuts)) {
    annotation.cuts = annotation.cuts.map((cut) =>
      cut?.cutHostId && annotationIdMap[cut.cutHostId]
        ? { ...cut, cutHostId: annotationIdMap[cut.cutHostId] }
        : cut
    );
  }
}
