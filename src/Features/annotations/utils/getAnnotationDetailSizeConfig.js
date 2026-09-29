// Text size of a DETAIL annotation (the callout bubble).
//
// The bubble is always FIXED relative to the base map (it zooms with the
// plan) and sized from its text: fontSize is a PDF POINT of the base map's
// print zone (see freeTextConstants.getTextPageScale), every other dimension
// of the bubble derives from it (getDetailBubbleGeometry).
//
// Resolution: annotation own value ?? template value ?? app default — the
// same READ-TIME model as getAnnotationLabelSizeConfig: the template value is
// not seeded at creation, so editing the template propagates to every
// annotation without its own value; the padlock (overrideFields) forces the
// template value through the generic override loop of
// getAnnotationPropsFromAnnotationTemplateProps.

export const DEFAULT_DETAIL_FONT_SIZE_PT = 12;
export const DETAIL_SIZE_FIELDS = ["fontSize"];

function parseFontSize(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function hasOwnDetailSizeValue(annotation) {
  return parseFontSize(annotation?.fontSize) !== undefined;
}

export default function getAnnotationDetailSizeConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const fontSize =
    parseFontSize(annotation?.fontSize) ??
    parseFontSize(templateProps?.fontSize) ??
    DEFAULT_DETAIL_FONT_SIZE_PT;
  return { fontSize };
}
