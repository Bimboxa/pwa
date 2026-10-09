import { MESH_3D_QTY_LABEL } from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";

// Parses a legend qty label like "429.2 m²" into { value: 429.2, unit: "m²" }.
// Labels are always built as `${qty} ${unit}` (getAnnotationTemplateMainQtyLabel),
// so parseFloat on the whole string is safe. Non-numeric labels ("- u") yield
// { value: null, unit }. The mesh 3D marker ("⚠ 3D") carries no unit: the
// stats' `mainQtyUnit` holds it.
export default function parseMainQtyLabel(label) {
  const str = typeof label === "string" ? label.trim() : "";
  if (str === MESH_3D_QTY_LABEL) return { value: null, unit: "" };
  const value = parseFloat(str.replace(",", "."));
  const spaceIndex = str.indexOf(" ");
  const unit = spaceIndex >= 0 ? str.slice(spaceIndex + 1).trim() : "";
  return { value: Number.isFinite(value) ? value : null, unit };
}
