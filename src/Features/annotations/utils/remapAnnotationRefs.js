// Remap helpers for annotation duplication. Given an old-id -> new-id map,
// they rewrite every reference an annotation copy holds so it points at the
// duplicated records instead of the sources. Shared by layer duplication
// (useCreateLayer) and scope duplication (duplicateScopeService) so both flows
// cover the exact same reference fields.

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
      points: Array.isArray(cut.points)
        ? cut.points.map((pt) =>
            pt?.id && pointIdMap[pt.id] ? { ...pt, id: pointIdMap[pt.id] } : pt
          )
        : cut.points,
    }));
  }
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
  if (
    annotation.proxy?.proxySourceAnnotationId &&
    annotationIdMap[annotation.proxy.proxySourceAnnotationId]
  ) {
    annotation.proxy = {
      ...annotation.proxy,
      proxySourceAnnotationId:
        annotationIdMap[annotation.proxy.proxySourceAnnotationId],
    };
  }
}
