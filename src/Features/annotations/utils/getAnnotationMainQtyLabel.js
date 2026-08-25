const unitMap = {
  UNIT: "u",
  METER: "ml",
  SQUARE_METER: "m²",
  CUBIC_METER: "m³",
};

export default function getAnnotationMainQtyLabel(annotation, qties) {
  let qty;
  let unit = unitMap.UNIT;

  const { type } = annotation ?? {};

  // EDGE CASE

  if (!annotation?.qties?.enabled) return "-";

  // --- VARIANT ---

  let variant = "LENGTH"; // SURFACE, "COUNT"

  if (["POLYGON", "RECTANGLE"].includes(type)) {
    variant = "SURFACE";
  } else if (type === "DETAIL") {
    variant = "COUNT";
  } else if (["POINT"].includes(type)) {
    // A POINT revolved around an axis carries a real linear quantity (the
    // circle perimeter) even without a height — see getAnnotationQties.
    const isRevolution = annotation?.shape3D?.key === "REVOLUTION";
    variant =
      (isRevolution || annotation?.height) && qties?.length
        ? "LENGTH"
        : "COUNT";
  }

  // --- LABEL ---

  if (variant === "COUNT") {
    qty = 1;
    unit = unitMap.UNIT;
  } else if (variant === "LENGTH") {
    qty = qties?.length;
    unit = unitMap.METER;
  } else if (variant === "SURFACE") {
    qty = qties?.surface;
    unit = unitMap.SQUARE_METER;
  }

  // --- QTY ---

  if (!qty) return "-";

  qty = Number(qty.toFixed(2));

  return `${qty} ${unit}`;
}
