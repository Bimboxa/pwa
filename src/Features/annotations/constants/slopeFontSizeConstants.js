// Slope indicator (« x% » + arrow) font size, a template-level display setting
// (`annotationTemplate.slopeFontSize`). Sizes are PDF points of the base map's
// print zone (see getCotePageScale), so the indicator stays fixed relative to
// the plan. The arrow glyphs scale with the font.

export const SLOPE_FONT_SIZES = [
  { key: "SMALL", label: "Petit", pt: 10 },
  { key: "MEDIUM", label: "Moyen", pt: 14 },
  { key: "LARGE", label: "Gros", pt: 20 },
];

export const DEFAULT_SLOPE_FONT_SIZE = "MEDIUM";

export function getSlopeFontSizePt(slopeFontSize) {
  const size =
    SLOPE_FONT_SIZES.find((s) => s.key === slopeFontSize) ??
    SLOPE_FONT_SIZES.find((s) => s.key === DEFAULT_SLOPE_FONT_SIZE);
  return size.pt;
}
