// Bundled title block manifest. Pixel-identical to the historical hardcoded
// cartouche (PortfolioHeaderSvg 3x5 grid) so orgs without a
// features.titleBlocks config and legacy portfolios render unchanged.
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
// - cells: grid content. `bind` tokens resolved at render time:
//   project.name | portfolio.name | page.title | pageNum | field:<fieldKey>.
//   `fallbackBind` = binding rendered while a field: bind has no stored
//   value (live default, e.g. chantier -> project.name).
//   `legacyLabelKey` = metadata key holding the user label override.
//   `trailing` carves a sub-cell at the right end of the cell.
// - decorations: vector art as svgPath primitives (path `d` data, drawn with
//   pdf-lib drawSvgPath at export). Coordinates relative to the rect top-left.
const defaultTitleBlockManifest = {
  key: "DEFAULT",
  name: "Cartouche",
  height: 84,
  rowHeights: [28, 28, 28],
  columns: [
    { key: "logo", width: 126, narrowWidth: { ratio: 0.2, max: 126 } },
    { key: "label", ratio: 0.08, min: 55, narrowWidth: 55 },
    { key: "main", flex: true },
    { key: "metaLabel", ratio: 0.11, min: 65, narrowWidth: 65 },
    { key: "metaValue", ratio: 0.15, min: 80, narrowWidth: 80 },
  ],
  fields: [
    { key: "chantier", label: "Chantier", placeholderMappedTo: "projectName" },
    { key: "refInterne", label: "Numéro", legacyKey: "refInterne" },
    { key: "author", label: "Auteur", mappedTo: "authorName", legacyKey: "author" },
    { key: "date", label: "Date", mappedTo: "todayS", legacyKey: "date" },
  ],
  cells: [
    { row: 0, col: "label", kind: "label", text: "Chantier", legacyLabelKey: "labelChantier" },
    { row: 0, col: "main", kind: "value", bind: "field:chantier", fallbackBind: "project.name", bold: true },
    { row: 0, col: "metaLabel", kind: "label", text: "Numéro", legacyLabelKey: "labelRefInterne" },
    { row: 0, col: "metaValue", kind: "value", bind: "field:refInterne" },
    { row: 1, col: "label", kind: "label", text: "Carnet", legacyLabelKey: "labelPortfolio" },
    { row: 1, col: "main", kind: "value", bind: "portfolio.name", bold: true },
    { row: 1, col: "metaLabel", kind: "label", text: "Auteur", legacyLabelKey: "labelAuteur" },
    { row: 1, col: "metaValue", kind: "value", bind: "field:author" },
    { row: 2, col: "label", kind: "label", text: "Page", legacyLabelKey: "labelPage" },
    {
      row: 2,
      col: "main",
      kind: "value",
      bind: "page.title",
      trailing: { width: 50, bind: "pageNum", center: true, bold: true },
    },
    { row: 2, col: "metaLabel", kind: "label", text: "Date", legacyLabelKey: "labelDate" },
    { row: 2, col: "metaValue", kind: "value", bind: "field:date" },
  ],
  logoSlot: { col: "logo", padding: 4 },
  decorations: [],
  style: {
    borderColor: "#333",
    borderWidth: 1,
    gridWidth: 0.5,
    labelFontSize: 8,
    valueFontSize: 10,
    labelColor: "#888",
    valueColor: "#333",
    fontFamily: "Helvetica, Arial, sans-serif",
  },
};

export default defaultTitleBlockManifest;
