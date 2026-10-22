// Sub-selection of one value card of the selected COTE / RULER in 3D: the
// selection item stays the annotation NODE, the card is its `partId` /
// `partType` (see the sprite pre-pass of MainThreedEditor, the two
// renderers and the label drag hooks). Unknown to resolveSelectedAnnotationPart
// on purpose: the properties panel keeps showing the annotation. A cote has
// one card (segment key "0"), a ruler one per segment key.
export const DIMENSION_LABEL_PART_TYPE = "DIMENSION_LABEL";

export const COTE_LABEL_SEGMENT_KEY = "0";

export function getDimensionLabelPartId(
  annotationId,
  segmentKey = COTE_LABEL_SEGMENT_KEY
) {
  return `${annotationId}::${DIMENSION_LABEL_PART_TYPE}::${segmentKey}`;
}
