const unitMap = {
  UNIT: "u",
  METER: "ml",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
};

export default function getAnnotationMainQtyLabel(
  annotation,
  qties
) {

  let qty;
  let unit = unitMap.UNIT;

  const { type } = annotation ?? {};

  // EDGE CASE

  if (!annotation?.qties?.enabled) return "-";


  // --- VARIANT ---

  let variant = "LENGTH"; // SURFACE, "COUNT"

  if (["POLYGON", "RECTANGLE"].includes(type)) {
    variant = "SURFACE";
  }

  else if (["POINT"].includes(type)) {
    variant = "COUNT";
  }

  // --- LABEL ---

  if (variant === "COUNT") {
    qty = 1;
    unit = unitMap.UNIT;
  }

  else if (variant === "LENGTH") {
    qty = qties?.length;
    unit = unitMap.METER;
  }

  else if (variant === "SURFACE") {
    qty = qties?.surface;
    unit = unitMap.SQUARE_METER;
  }

  // --- QTY ---

  if (!qty) return "-";

  qty = Number(qty.toFixed(2));

  return `${qty} ${unit}`;
}
