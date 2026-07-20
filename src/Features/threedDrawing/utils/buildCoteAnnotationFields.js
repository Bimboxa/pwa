import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

import { NON_TEMPLATE_KEYS } from "./buildFaceAnnotationFields";

// Keys owned by the cote geometry/commit service — never taken from the
// template-armed newAnnotation. `offset3d` (the 3D dimension-line offset of
// a vertical/oblique cote) and `labelOffset` (the free 2D label placement of
// a degenerate cote) are per-annotation state and must not leak from a
// previously drawn cote into the next one via the template draft.
const NON_TEMPLATE_COTE_KEYS = new Set([
  ...NON_TEMPLATE_KEYS,
  "offset3d",
  "labelOffset",
]);

// Pure merge of the annotation style fields for a cote drawn in 3D:
// COTE shape defaults < template props < geometry fields ({type, offsetZ?}).
// `extensionOffset` / `extensionOffsetUnit` are regular template props and
// pass through, so an in-plane 3D cote shares the 2D offset behavior.
export default function buildCoteAnnotationFields({
  classificationFields, // { type: "COTE", offsetZ? }
  templateProps = null, // the template-armed newAnnotation (or null)
}) {
  const defaults = getDefaultsForShape("COTE");
  if (!templateProps) return { ...defaults, ...classificationFields };

  const sanitized = {};
  for (const [key, value] of Object.entries(templateProps)) {
    if (NON_TEMPLATE_COTE_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    sanitized[key] = value;
  }

  return { ...defaults, ...sanitized, ...classificationFields };
}
