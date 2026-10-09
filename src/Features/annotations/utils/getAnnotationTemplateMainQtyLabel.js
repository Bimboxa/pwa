// Main quantity of a template row ("172 m²", "14.5 ml", "3 u"). Relative
// imports only: node-testable through mergePaintedQtiesIntoTemplateQties.

// Label shown instead of the surface / length total when the template holds
// at least one mesh 3D annotation (stats.mesh3dCount > 0): the total is not
// computed at all — neither the other annotations' nor the painted parts' —
// only the unit count keeps its meaning.
export const MESH_3D_QTY_LABEL = "⚠ 3D";

// Tooltip of the per-annotation "⚠ 3D" marker (rows, toolbar, properties).
export const MESH_3D_QTIES_TOOLTIP =
  "Mesh 3D : surface et linéaire non calculés. Les faces / arêtes se mesurent individuellement (sélection, Pinceau).";

const unitMap = {
  UNIT: "u",
  METER: "ml",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
};

// "U" | "L" | "S": template.mainQtyKey, else from its type.
export function getAnnotationTemplateMainQtyKey(annotationTemplate) {
  const { type, mainQtyKey } = annotationTemplate ?? {};
  let defaultMainQtyKey = "U";
  if (["POLYLINE", "STRIP", "LINEAR_LAYOUT"].includes(type))
    defaultMainQtyKey = "L";
  if (["POLYGON"].includes(type)) defaultMainQtyKey = "S";
  return mainQtyKey ?? defaultMainQtyKey;
}

// "u" | "ml" | "m²" — kept on the stats (mainQtyUnit) so the legend manual
// override still knows the unit when the label is MESH_3D_QTY_LABEL.
export function getAnnotationTemplateMainQtyUnit(annotationTemplate) {
  const qtyKey = getAnnotationTemplateMainQtyKey(annotationTemplate);
  if (qtyKey === "L") return unitMap.METER;
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

  if (qtyKey !== "U" && (qties?.mesh3dCount ?? 0) > 0) return MESH_3D_QTY_LABEL;

  if (!Number.isFinite(qty)) return `- ${unit}`;

  qty = Number(qty.toFixed(1));

  return `${qty} ${unit}`;
}
