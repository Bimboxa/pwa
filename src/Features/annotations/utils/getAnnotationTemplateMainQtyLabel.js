// Main quantity of a template row ("172 m²", "14.5 ml", "3 u"). Relative
// imports only: node-testable through mergePaintedQtiesIntoTemplateQties.

const unitMap = {
  UNIT: "u",
  METER: "ml",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
};

// "U" | "L" | "S" | "C": template.mainQtyKey, else from its type.
// "C" = longueur de calepinage (Σ bars of the POLYGON layout lines, ml).
export function getAnnotationTemplateMainQtyKey(annotationTemplate) {
  const { type, mainQtyKey } = annotationTemplate ?? {};
  let defaultMainQtyKey = "U";
  if (["POLYLINE", "STRIP", "LINEAR_LAYOUT"].includes(type))
    defaultMainQtyKey = "L";
  if (["POLYGON", "DISC"].includes(type)) defaultMainQtyKey = "S";
  // "C" needs the Calepinage feature (template.hasLayoutLines): a template
  // that turned it off falls back to its default key.
  if (mainQtyKey === "C" && !annotationTemplate?.hasLayoutLines)
    return defaultMainQtyKey;
  return mainQtyKey ?? defaultMainQtyKey;
}

// "u" | "ml" | "m²" — kept on the stats (mainQtyUnit) for the legend manual
// override.
export function getAnnotationTemplateMainQtyUnit(annotationTemplate) {
  const qtyKey = getAnnotationTemplateMainQtyKey(annotationTemplate);
  if (qtyKey === "L" || qtyKey === "C") return unitMap.METER;
  if (qtyKey === "S") return unitMap.SQUARE_METER;
  return unitMap.UNIT;
}

export default function getAnnotationTemplateMainQtyLabel(
  annotationTemplate,
  qties
) {
  const qtyKey = getAnnotationTemplateMainQtyKey(annotationTemplate);
  const unit = getAnnotationTemplateMainQtyUnit(annotationTemplate);

  let qty = qties?.unit;
  if (qtyKey === "L") qty = qties?.length;
  else if (qtyKey === "S") qty = qties?.surface;
  else if (qtyKey === "C") qty = qties?.layoutLength;

  if (!Number.isFinite(qty)) return `- ${unit}`;

  qty = Number(qty.toFixed(1));

  return `${qty} ${unit}`;
}
