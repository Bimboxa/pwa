// Normalizes a group label for duplicate detection: trims, uppercases and
// strips all whitespace, so "Réseaux " and "réseaux" collapse to the same key.
// Same rule as the inline copies in the legend hooks and in
// groupAnnotationTemplatesByGroupLabel.js. Note: it does NOT strip accents, so
// "réseau" and "réseaux" still resolve to distinct keys.
export default function normalizeGroupLabel(groupLabel) {
  return (groupLabel ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
