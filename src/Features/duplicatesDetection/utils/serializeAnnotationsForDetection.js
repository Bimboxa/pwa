// Minimal, structured-clone friendly payload of the candidates for the
// worker: only what buildAnnotationEdgeRings / findOverlappingAnnotations
// read (the point `type` drives the arc expansion).

function serializePoint(p) {
  return { id: p.id, x: p.x, y: p.y, type: p.type };
}

export default function serializeAnnotationsForDetection(annotations) {
  return (annotations ?? []).map((a) => ({
    id: a.id,
    type: a.type,
    annotationTemplateId: a.annotationTemplateId,
    layerId: a.layerId ?? null,
    createdAt: a.createdAt ?? null,
    closeLine: Boolean(a.closeLine),
    points: (a.points ?? []).map(serializePoint),
    cuts: (a.cuts ?? [])
      .filter((cut) => cut?.points?.length)
      .map((cut) => ({ points: cut.points.map(serializePoint) })),
  }));
}
