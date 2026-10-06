// Id of the revolution axis an annotation row belongs to, or null — pure,
// import-free (node-testable, shared with the meshPaint visibility rule).
//
// "Linked to an axis" = the axis itself (REVOLUTION_AXIS), its placements on
// the vertical base maps (REVOLUTION_AXIS_PLACEMENT.revolutionAxisId) and
// every annotation revolved around it (REVOLUTION shape3D.axisAnnotationId:
// POLYLINE profiles, POINT circles) — and the read-only plan footprints of
// those (isRevolutionFootprint, synthesized by useAnnotationsV2, which carry
// `revolutionAxisId` and no shape3D). Drives the eye and the solo of the
// revolution axis rows (SectionRevolutionAxes).
export default function getRevolutionAxisIdOfAnnotation(annotation) {
  if (!annotation) return null;
  if (annotation.isRevolutionFootprint)
    return annotation.revolutionAxisId ?? null;
  if (annotation.type === "REVOLUTION_AXIS") return annotation.id ?? null;
  if (annotation.type === "REVOLUTION_AXIS_PLACEMENT")
    return annotation.revolutionAxisId ?? null;
  const shape3D = annotation.shape3D;
  const key = typeof shape3D === "string" ? shape3D : shape3D?.key;
  if (key === "REVOLUTION") return shape3D?.axisAnnotationId ?? null;
  return null;
}
