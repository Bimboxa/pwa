import { lighten } from "@mui/material/styles";

// How much the colors of an "old" annotation are pulled towards white.
const LIGHTEN = 0.7;

// source annotation -> its dimmed copy: an annotation that did not change
// keeps the same dimmed object (the 2D nodes and the 3D diff rebuild nothing)
const cache = new WeakMap();

function lightenColor(color) {
  if (typeof color !== "string" || !color) return color;
  try {
    return lighten(color, LIGHTEN);
  } catch {
    // color format MUI cannot parse: left as is
    return color;
  }
}

// "Highlight the new annotations of the phase" (phases strip toggle): the
// annotations that are not new in the displayed phases get a lighter tint,
// the new ones keep their colors. `newIdSet`: usePhaseNewAnnotationIdSet
// (null = toggle off / nothing old: the input array is returned as is). Base
// map annotations are never dimmed. Display only: the copies are tagged
// `_phaseDimmed`.
export default function dimPhaseOldAnnotations(annotations, newIdSet) {
  if (!annotations || !newIdSet) return annotations;
  return annotations.map((annotation) => {
    if (annotation.isBaseMapAnnotation || newIdSet.has(annotation.id))
      return annotation;
    let dimmed = cache.get(annotation);
    if (!dimmed) {
      dimmed = {
        ...annotation,
        fillColor: lightenColor(annotation.fillColor),
        strokeColor: lightenColor(annotation.strokeColor),
        _phaseDimmed: true,
      };
      cache.set(annotation, dimmed);
    }
    return dimmed;
  });
}
