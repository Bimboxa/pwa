// Template-driven wall opening (door / window): a 2-point POLYLINE carrying
// drawingShape "OPENING" (rows created before drawingShape was stored are
// recognised by the isOpening flag + the 2-point geometry). Shared by the
// renderer dispatch, the transient drag ghost and the draw-order passes.
export default function isOpeningAnnotation(annotation) {
  if (!annotation) return false;
  if (annotation.drawingShape === "OPENING") return true;
  return Boolean(annotation.isOpening) && annotation.points?.length === 2;
}

export const OPENING_TYPES = ["NONE", "DOOR", "WINDOW"];

export function getOpeningType(annotation) {
  const type = annotation?.openingType;
  return OPENING_TYPES.includes(type) ? type : "NONE";
}

// Draw-order helper: openings paint a white gap OVER their host wall, so they
// must be rendered after every other annotation. Stable partition (relative
// order preserved within each group); returns the same array when nothing
// needs to move.
export function sortOpeningsLast(annotations) {
  if (!Array.isArray(annotations) || annotations.length === 0) {
    return annotations;
  }
  const others = [];
  const openings = [];
  for (const a of annotations) {
    (isOpeningAnnotation(a) ? openings : others).push(a);
  }
  if (openings.length === 0) return annotations;
  return [...others, ...openings];
}
