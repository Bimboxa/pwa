// Minimal, structured-clone friendly payload of the candidates for the
// worker: only what buildAnnotationEdgeRings / findOverlappingAnnotations /
// findOverlappingCuts read (the point `type` drives the arc expansion).
// `cutsOnlyIds`: annotations sent for their own cuts only, not compared with
// the others (see getCutOverlapCandidates).

function serializePoint(p) {
  return { id: p.id, x: p.x, y: p.y, type: p.type };
}

export default function serializeAnnotationsForDetection(
  annotations,
  { cutsOnlyIds = null } = {}
) {
  return (annotations ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    annotationTemplateId: a.annotationTemplateId,
    layerId: a.layerId ?? null,
    createdAt: a.createdAt ?? null,
    closeLine: Boolean(a.closeLine),
    cutsOnly: Boolean(cutsOnlyIds?.has(a.id)),
    points: (a.points ?? []).map(serializePoint),
    cuts: (a.cuts ?? [])
      .filter((cut) => cut?.points?.length)
      .map((cut) => ({ id: cut.id, points: cut.points.map(serializePoint) })),
  }));
}
