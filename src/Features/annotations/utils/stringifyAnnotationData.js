// Pretty-prints annotation data for the "Copy ... data" debug buttons,
// rounding point x/y coordinates to 3 decimals to keep the JSON compact.
export default function stringifyAnnotationData(value) {
  return JSON.stringify(
    value,
    (key, val) =>
      (key === "x" || key === "y") && typeof val === "number"
        ? Math.round(val * 1000) / 1000
        : val,
    2
  );
}
