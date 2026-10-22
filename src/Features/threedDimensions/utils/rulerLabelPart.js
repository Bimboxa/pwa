// Sub-selection of one value card of the selected RULER in 3D: the selection
// item stays the ruler NODE, the card is its `partId` / `partType` (see the
// sprite pre-pass of MainThreedEditor, ThreedRulerAnnotations and
// useRulerLabelDragHandlers). Unknown to resolveSelectedAnnotationPart on
// purpose: the properties panel keeps showing the ruler.
export const RULER_LABEL_PART_TYPE = "RULER_LABEL";

export function getRulerLabelPartId(rulerId, segmentKey) {
  return `${rulerId}::${RULER_LABEL_PART_TYPE}::${segmentKey}`;
}
