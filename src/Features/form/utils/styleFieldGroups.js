// Template style props toggled together by the section-level locks
// (overrideFields) in FieldFillCompact / FieldStrokeCompact /
// FieldStrokeWidthCompact.

export const FILL_FIELDS = ["fillColor", "fillType", "fillOpacity"];

// "Contour": the visual style of the line — colour, opacity, solid / dashed,
// and the coloured dash bands of DASHED strips (they define the pattern).
export const STROKE_FIELDS = [
  "strokeColor",
  "strokeType",
  "strokeOpacity",
  "dashLength",
  "dashGap",
];

// "Épaisseur": locked separately from the style so annotations sharing a
// template can carry their own width. NOT part of the default lock set of a
// new template (see DialogCreateAnnotationTemplate).
export const STROKE_WIDTH_FIELDS = ["strokeWidth", "strokeWidthUnit"];

// Short French labels used by the section locks (StyleGroupLock) to spell out
// a partial lock ("Verrou partiel : couleur").
export const STYLE_FIELD_LABELS = {
  fillColor: "couleur",
  fillType: "motif",
  fillOpacity: "opacité",
  strokeColor: "couleur",
  strokeType: "style",
  strokeOpacity: "opacité",
  dashLength: "bandes",
  dashGap: "bandes",
  strokeWidth: "épaisseur",
  strokeWidthUnit: "unité",
};
