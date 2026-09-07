// "2px" / "20cm" from { strokeWidth, strokeWidthUnit } — used by the template
// rows to preview the thickness of the next drawn stroke. Returns null when no
// numeric width is set.
export default function getStrokeWidthLabel({
  strokeWidth,
  strokeWidthUnit,
} = {}) {
  const value = Number(strokeWidth);
  if (!Number.isFinite(value)) return null;
  const unit = strokeWidthUnit === "CM" ? "cm" : "px";
  return `${value}${unit}`;
}
