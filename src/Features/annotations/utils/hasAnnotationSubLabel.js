// Types without a draggable sub-label (no labelDelta model): no Etiquette
// panel, no show/hide label toggle.
const TYPES_WITHOUT_LABEL = [
  "COTE",
  "RULER",
  "TEXT",
  "LABEL",
  "FREE_TEXT",
  "DETAIL",
];

export default function hasAnnotationSubLabel(annotation) {
  return Boolean(
    annotation &&
      !TYPES_WITHOUT_LABEL.includes(annotation.type) &&
      !annotation.isMeshCell &&
      !annotation.isBaseMapAnnotation
  );
}
