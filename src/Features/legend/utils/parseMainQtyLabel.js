// Parses a legend qty label like "429.2 m²" into { value: 429.2, unit: "m²" }.
// Labels are always built as `${qty} ${unit}` (getAnnotationTemplateMainQtyLabel),
// so parseFloat on the whole string is safe. Non-numeric labels ("- u") yield
// { value: null, unit }.
export default function parseMainQtyLabel(label) {
  const str = typeof label === "string" ? label.trim() : "";
  const value = parseFloat(str.replace(",", "."));
  const spaceIndex = str.indexOf(" ");
  const unit = spaceIndex >= 0 ? str.slice(spaceIndex + 1).trim() : "";
  return { value: Number.isFinite(value) ? value : null, unit };
}
