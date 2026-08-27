// FREE_TEXT font choices — web-safe stacks only (no external font loading).
// `key` is what is stored on the template / annotation (fontFamily prop).

export const FREE_TEXT_FONT_OPTIONS = [
  {
    key: "Roboto",
    label: "Roboto",
    stack: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    key: "Arial",
    label: "Arial",
    stack: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  },
  {
    key: "Helvetica",
    label: "Helvetica",
    stack: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
  },
  {
    key: "Times New Roman",
    label: "Times New Roman",
    stack: '"Times New Roman", Times, serif',
  },
  {
    key: "Georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    key: "Courier New",
    label: "Courier New",
    stack: '"Courier New", Courier, monospace',
  },
];

export function getFreeTextFontStack(fontFamily) {
  return (
    FREE_TEXT_FONT_OPTIONS.find((o) => o.key === fontFamily)?.stack ??
    FREE_TEXT_FONT_OPTIONS[0].stack
  );
}

// FREE_TEXT-specific template / annotation style fields — the subset restored
// by "Réinit." and toggled as ONE group by the template padlock.
export const FREE_TEXT_FIELDS = [
  "fillColor",
  "hasBackground",
  "textColor",
  "borderColor",
  "fontFamily",
  "fontSize",
  "pageFormat",
  "fontWeight",
  "fontItalic",
  "fontUnderline",
  "textAlign",
  "hasBorder",
  "hasPadding",
  "hasConnector",
];

// "Format de la page": the text size is expressed in PDF POINTS as if the
// base map filled an A4 / A3 page (matching the portfolio PDF export, see
// portfolioEditor/utils/getPageDimensions.js — 1 pt = 1/72 inch). The box is
// rendered at scale k = imageLongSide / pageLongSide, so a 14pt text reads
// as a 14pt text on the exported page whatever the image resolution.
export const FREE_TEXT_PAGE_FORMATS = [
  { key: "A4", label: "A4" },
  { key: "A3", label: "A3" },
];

const PAGE_LONG_SIDE_PT = { A4: 842, A3: 1191 };

export function getFreeTextPageScale(pageFormat, imageLongSidePx) {
  const longSide = PAGE_LONG_SIDE_PT[pageFormat] ?? PAGE_LONG_SIDE_PT.A4;
  return imageLongSidePx > 0 ? imageLongSidePx / longSide : 1;
}
