// Size mode of an annotation's label chip (sub-label of the "Etiquette" tab —
// the standalone LABEL annotation has its own `isFixedSize`, see
// getAnnotationLabelSizeConfig).
//
// - labelIsFixedSize: true (default) → the chip is FIXED relative to the base
//   map's print zone: it zooms with the plan and every size inside it (S/M/L
//   font, padding, labelWidth, leader stub) is a PDF POINT of the sheet.
//   false → constant SCREEN size (counter-zoomed chip), sizes are screen px.
//
// Resolution: annotation own value ?? template value ?? app default — the
// same READ-TIME model as the leader stub (getAnnotationLabelStubConfig); the
// padlock (overrideFields) forces the template value through the generic
// override loop of getAnnotationPropsFromAnnotationTemplateProps.

export const DEFAULT_LABEL_IS_FIXED_SIZE = true;
export const LABEL_FIXED_SIZE_FIELDS = ["labelIsFixedSize"];

function parseIsFixedSize(raw) {
  return typeof raw === "boolean" ? raw : undefined;
}

export function hasOwnLabelFixedSizeValue(annotation) {
  return parseIsFixedSize(annotation?.labelIsFixedSize) !== undefined;
}

export default function getAnnotationLabelFixedSizeConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const isFixedSize =
    parseIsFixedSize(annotation?.labelIsFixedSize) ??
    parseIsFixedSize(templateProps?.labelIsFixedSize) ??
    DEFAULT_LABEL_IS_FIXED_SIZE;
  return { isFixedSize };
}
