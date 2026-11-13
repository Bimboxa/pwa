// The base map the « Vue en plan » label of a placed revolution axis
// (REVOLUTION_AXIS_PLACEMENT, the inverted T on a vertical base map) leads
// to, or null: the plan hosting the axis it stands for
// (`revolutionAxisBaseMapId`, stamped at read time by useAnnotationsV2).
// A click on the label opens that base map (2D node); the hover tooltip
// previews it (MapTooltip).
export default function getRevolutionAxisPlacementNavTargetId(annotation) {
  if (annotation?.type !== "REVOLUTION_AXIS_PLACEMENT") return null;
  return annotation.revolutionAxisBaseMapId ?? null;
}
