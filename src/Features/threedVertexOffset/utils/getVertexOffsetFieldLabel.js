const FIELD_LABELS = {
  offsetTop: "Décalage haut",
  offsetBottom: "Décalage bas",
};

// Wording of a per-point offset field (the vertex offset chip and helper).
export default function getVertexOffsetFieldLabel(field) {
  return FIELD_LABELS[field] ?? "Décalage";
}
