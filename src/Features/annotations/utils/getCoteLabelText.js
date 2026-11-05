import { COTE_STYLE_LABEL } from "Features/annotations/constants/coteDisplayDefaults";

import { getAnnotationOwnLabel } from "./getAnnotationLabelDisplay";

// Text displayed by a COTE: the measured value, prefixed by the annotation's
// OWN label in the "Étiquette" style ("D1 = 2.34 m"). Without a label (or in
// the standard style) the value stays bare. Shared by the 2D renderer, the 3D
// value card and the previews.
export default function getCoteLabelText({ annotation, valueText }) {
  if (annotation?.coteStyle !== COTE_STYLE_LABEL) return valueText;
  const raw = getAnnotationOwnLabel(annotation);
  const label = typeof raw === "string" ? raw.trim() : "";
  return label ? `${label} = ${valueText}` : valueText;
}
