// Size mode of an annotation's label chip (sub-label of the "Etiquette" tab —
// the standalone LABEL annotation has its own `isFixedSize`, see
// getAnnotationLabelSizeConfig).
//
// The chip is ALWAYS fixed relative to the base map's print zone: it zooms
// with the plan and every size inside it (font size, padding, labelWidth,
// leader stub) is a PDF POINT of the sheet.
//
// The former `labelIsFixedSize` option (annotation / template, false =
// constant screen size in px) was removed: values still stored on old rows
// are ignored.

export default function getAnnotationLabelFixedSizeConfig() {
  return { isFixedSize: true };
}
