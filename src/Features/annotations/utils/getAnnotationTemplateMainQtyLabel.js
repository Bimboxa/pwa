export default function getAnnotationTemplateMainQtyLabel(
  annotationTemplate,
  qties
) {
  const { type, closeLine } = annotationTemplate ?? {};

  const unitMap = {
    UNIT: "u",
    METER: "ml",
    SQUARE_METER: "m²",
    CUBIC_METER: "m³",
  };

  let qty = qties?.unit;
  let unit = unitMap.UNIT;

  if (type === "POLYLINE" && !closeLine) {
    qty = qties?.length;
    unit = unitMap.METER;
  } else if (type === "POLYLINE" && closeLine) {
    qty = qties?.surface;
    unit = unitMap.SQUARE_METER;
  }

  qty = Number(qty.toFixed(1));

  return `${qty ?? "-"} ${unit}`;
}
