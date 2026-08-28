// Bundled title block manifest (technical-drawing style: each cell shows its
// uppercase label at the top-left, value below).
//
// Manifest contract (shared by screen SVG + pdf-lib export, sizes in pt,
// 1 SVG unit == 1 PDF pt):
// - height / rowHeights: overall geometry, height feeds getPageLayout.
// - columns: resolved against the target rect width. `width` = fixed,
//   `ratio`+`min` = proportional to the width remaining after fixed columns,
//   `flex` absorbs the remainder. `narrowWidth` overrides for the
//   BOTTOM_RIGHT (A3 landscape) variant: a number = fixed, an object
//   { ratio, max } = proportional to the FULL rect width.
// - fields: editable values -> creation form + properties panel.
//   `mappedTo` = auto-fill token from useDataMapping (form prefill only).
//   `placeholderMappedTo` = same token vocabulary, but only shown as the
//   form input placeholder (live default, nothing persisted).
//   `legacyKey` = portfolio.metadata key used by pre-titleBlock portfolios.
// - cells: grid content, one value cell per entry. `bind` tokens resolved at
//   render time: project.name | portfolio.name | page.title | pageNum |
//   field:<fieldKey>. `fallbackBind` = binding rendered while a field: bind
//   has no stored value (live default, e.g. chantier -> project.name).
//   `label` = caption rendered uppercase in a small band at the top of the
//   cell (style.labelBandHeight tall); the value centers in the band below.
//   `legacyLabelKey` = metadata key holding the user label override.
//   `colSpan` merges the cell across N columns (suppresses the crossed
//   vertical separators on that row). `align` = left (default) | center |
//   right (labels follow right alignment, otherwise stay left).
// - logoSlot: `footer` reserves a band at the bottom of the logo column for a
//   mixed-weight caption ({ height, fontSize, spans: [{ text, bold }] }).
// - decorations: vector art as svgPath primitives (path `d` data, drawn with
//   pdf-lib drawSvgPath at export). Coordinates relative to the rect top-left.
const defaultTitleBlockManifest = {
  key: "DEFAULT",
  name: "Cartouche",
  height: 108,
  rowHeights: [36, 36, 36],
  columns: [
    { key: "logo", width: 126, narrowWidth: { ratio: 0.2, max: 126 } },
    { key: "main", flex: true },
    { key: "mid", ratio: 0.3, min: 90, narrowWidth: 85 },
    { key: "meta", ratio: 0.3, min: 90, narrowWidth: 85 },
  ],
  fields: [
    { key: "chantier", label: "Chantier", placeholderMappedTo: "projectName" },
    { key: "refInterne", label: "Numéro", legacyKey: "refInterne" },
    { key: "reference", label: "Référence", mappedTo: "timestampRef" },
    { key: "author", label: "Auteur", mappedTo: "authorName", legacyKey: "author" },
    { key: "date", label: "Date", mappedTo: "todayS", legacyKey: "date" },
  ],
  cells: [
    // row 0: FOLIO (page title, spans main+mid) | DATE
    { row: 0, col: "main", colSpan: 2, label: "Folio", bind: "page.title", bold: true },
    { row: 0, col: "meta", label: "Date", bind: "field:date", legacyLabelKey: "labelDate" },
    // row 1: DOCUMENT | AUTEUR | RÉFÉRENCE
    { row: 1, col: "main", label: "Document", bind: "portfolio.name", legacyLabelKey: "labelPortfolio" },
    { row: 1, col: "mid", label: "Auteur", bind: "field:author", legacyLabelKey: "labelAuteur" },
    { row: 1, col: "meta", label: "Référence", bind: "field:reference" },
    // row 2: CHANTIER | NUMÉRO | PAGE
    {
      row: 2,
      col: "main",
      label: "Chantier",
      bind: "field:chantier",
      fallbackBind: "project.name",
      legacyLabelKey: "labelChantier",
    },
    { row: 2, col: "mid", label: "Numéro", bind: "field:refInterne", legacyLabelKey: "labelRefInterne" },
    {
      row: 2,
      col: "meta",
      label: "Page",
      bind: "pageNum",
      bold: true,
      align: "right",
      legacyLabelKey: "labelPage",
    },
  ],
  logoSlot: {
    col: "logo",
    padding: 4,
    footer: {
      height: 12,
      fontSize: 6,
      spans: [{ text: "CRÉÉ AVEC " }, { text: "Krto", bold: true }, { text: " ®" }],
    },
  },
  decorations: [],
  style: {
    borderColor: "#333",
    borderWidth: 1,
    gridWidth: 0.5,
    labelFontSize: 6.5,
    labelBandHeight: 13,
    valueFontSize: 10,
    labelColor: "#888",
    valueColor: "#222",
    fontFamily: "Helvetica, Arial, sans-serif",
  },
};

export default defaultTitleBlockManifest;
