// Style fields copied from an imported template onto each imported annotation,
// so both the paste ghost and the placed annotation render correctly even
// before the (newly created) template is resolved by the render layer.
//
// This allowlist only serves the "inline JSON" format (hand-drawing / AI
// prompts), whose templates carry a hand-picked subset of style keys. The
// "dump" format (Copy annotations data) goes the other way round: it ships
// full DB rows and is scrubbed with a denylist in normalizeAnnotationsDumpJson.
export const STYLE_FIELDS = [
  "fillColor",
  "fillOpacity",
  "fillType",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeType",
  // STRIP (band width is carried by strokeWidth/strokeWidthUnit)
  "stripOrientation",
  "dashLength",
  "dashGap",
  // COTE / RULER
  "unit",
  "decimals",
  "fontSize",
  "showUnitLabel",
  "extensionOffset",
  "extensionOffsetUnit",
  "showTotalCote",
  "showRulerLabel",
  // label leader stub
  "labelStubLength",
  "labelStubMode",
  // CIRCULATION
  "arrowStep",
  "arrowRight",
  "arrowLeft",
  // FREE_TEXT
  "hasBackground",
  "textColor",
  "borderColor",
  "fontFamily",
  "pageFormat",
  "fontWeight",
  "fontItalic",
  "fontUnderline",
  "textAlign",
  "hasBorder",
  "hasPadding",
  "hasConnector",
];

export function pickStyle(obj) {
  const out = {};
  for (const key of STYLE_FIELDS) {
    if (obj?.[key] !== undefined && obj[key] !== null) out[key] = obj[key];
  }
  return out;
}
