// "Taille fixe" of a standalone LABEL annotation (the chip + leader type).
//
// - isFixedSize: false (default) → constant SCREEN size, the historical
//   NodeLabelStatic behaviour (counter-zoomed chip, 14px font).
//   true → the chip is FIXED relative to the base map and follows the
//   FREE_TEXT display rules: it zooms with the plan and every size inside
//   the chip (font, padding, width, leader stub) is a PDF POINT "as if the
//   base map filled an A4/A3 page" (pageFormat, see
//   freeTextConstants.getFreeTextPageScale).
// - fontSize: text size in page points (fixed mode only).
// - pageFormat: "A4" | "A3" (fixed mode only).
//
// Resolution: annotation own value ?? template value ?? app default — the
// same READ-TIME model as the leader stub (getAnnotationLabelStubConfig):
// the template value is not seeded at creation, so editing the template
// propagates to every annotation without its own value; the padlock
// (overrideFields) forces the template value through the generic override
// loop of getAnnotationPropsFromAnnotationTemplateProps.

import { FREE_TEXT_PAGE_FORMATS } from "Features/annotations/constants/freeTextConstants";

export const DEFAULT_LABEL_FONT_SIZE_PT = 14;
export const DEFAULT_LABEL_PAGE_FORMAT = "A4";
export const LABEL_SIZE_FIELDS = ["isFixedSize", "fontSize", "pageFormat"];

function parseIsFixedSize(raw) {
  return typeof raw === "boolean" ? raw : undefined;
}

function parseFontSize(raw) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function parsePageFormat(raw) {
  return FREE_TEXT_PAGE_FORMATS.some((f) => f.key === raw) ? raw : undefined;
}

export function hasOwnLabelSizeValue(annotation) {
  return (
    parseIsFixedSize(annotation?.isFixedSize) !== undefined ||
    parseFontSize(annotation?.fontSize) !== undefined ||
    parsePageFormat(annotation?.pageFormat) !== undefined
  );
}

export default function getAnnotationLabelSizeConfig(annotation) {
  const templateProps =
    annotation?.annotationTemplateProps ?? annotation?.annotationTemplate;
  const isFixedSize =
    parseIsFixedSize(annotation?.isFixedSize) ??
    parseIsFixedSize(templateProps?.isFixedSize) ??
    false;
  const fontSize =
    parseFontSize(annotation?.fontSize) ??
    parseFontSize(templateProps?.fontSize) ??
    DEFAULT_LABEL_FONT_SIZE_PT;
  const pageFormat =
    parsePageFormat(annotation?.pageFormat) ??
    parsePageFormat(templateProps?.pageFormat) ??
    DEFAULT_LABEL_PAGE_FORMAT;
  return { isFixedSize, fontSize, pageFormat };
}
