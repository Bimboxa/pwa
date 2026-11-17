import { COMPONENT_SHAPE } from "../constants/componentConstants";

// A « Composant » template (see constants/componentConstants.js).
export default function isComponentTemplate(template) {
  return template?.drawingShape === COMPONENT_SHAPE;
}
