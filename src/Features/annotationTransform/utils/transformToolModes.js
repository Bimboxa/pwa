// 2D drawing modes (and tool group types) of the « Déplacer » / « Tourner »
// tools.
export const MOVE_ANNOTATION_MODE = "MOVE_ANNOTATION";
export const ROTATE_ANNOTATION_MODE = "ROTATE_ANNOTATION";

export const TRANSFORM_TOOL_MODES = [
  MOVE_ANNOTATION_MODE,
  ROTATE_ANNOTATION_MODE,
];

export function isTransformToolMode(mode) {
  return TRANSFORM_TOOL_MODES.includes(mode);
}
