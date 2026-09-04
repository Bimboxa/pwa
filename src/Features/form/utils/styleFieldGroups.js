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
