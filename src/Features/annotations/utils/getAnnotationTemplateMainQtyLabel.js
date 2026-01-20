export default function getAnnotationTemplateMainQtyLabel(
  annotationTemplate,
  qties
) {
  const { type, mainQtyKey } = annotationTemplate ?? {};

  const unitMap = {
    UNIT: "u",
    METER: "ml",
    SQUARE_METER: "m²",
    CUBIC_METER: "m³",
  };

  let qty = qties?.unit;
  let unit = unitMap.UNIT;

  let defaultMainQtyKey = "U";
  if (["POLYLINE", "STRIP"]?.includes(type)) defaultMainQtyKey = "L";
  if (["POLYGON"]?.includes(type)) defaultMainQtyKey = "S";

  const qtyKey = mainQtyKey ?? defaultMainQtyKey;

  if (qtyKey === "L") {
    qty = qties?.length;
    unit = unitMap.METER;
  } else if (qtyKey === "S") {
    qty = qties?.surface;
    unit = unitMap.SQUARE_METER;
  }

  qty = Number(qty.toFixed(1));

  return `${qty ?? "-"} ${unit}`;
}
