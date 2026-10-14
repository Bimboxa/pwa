// Default lift of a 3D label card above its anchor point (meters, along the
// basemap normal): the card floats 1 m over the annotation instead of
// covering it, with the leader running down to the anchor. 3D display only —
// the shared labelDelta (image px, in the basemap plane) is untouched, so
// the 2D chip keeps its own placement. A vertical drag of the card in 3D
// (useAnnotationLabelDragHandlers) persists its own lift in
// `annotation.labelLift3d` (meters).
export const LABEL_CARD_LIFT_M = 1;

export default function getAnnotationLabelLiftM(annotation) {
  const lift = Number(annotation?.labelLift3d);
  return Number.isFinite(lift) ? lift : LABEL_CARD_LIFT_M;
}
