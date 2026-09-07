import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { FREE_TEXT_FIELDS } from "Features/annotations/constants/freeTextConstants";

// FREE_TEXT style defaults restricted to the style fields — what "Réinit."
// (template popover) and "Réinitialiser le style" (annotation panel) restore.
export default function getFreeTextStyleDefaults() {
  const defaults = getDefaultsForShape("FREE_TEXT");
  const changes = {};
  FREE_TEXT_FIELDS.forEach((field) => {
    if (field in defaults) changes[field] = defaults[field];
  });
  return changes;
}
