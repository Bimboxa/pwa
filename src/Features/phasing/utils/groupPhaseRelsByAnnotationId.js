// annotationId -> its live db.relsPhaseAnnotation rows.
//
// Pure: node-testable.
export default function groupPhaseRelsByAnnotationId(rels) {
  const relsByAnnotationId = new Map();
  for (const rel of rels ?? []) {
    if (!rel || rel.deletedAt) continue;
    const list = relsByAnnotationId.get(rel.annotationId);
    if (list) list.push(rel);
    else relsByAnnotationId.set(rel.annotationId, [rel]);
  }
  return relsByAnnotationId;
}
