import {
  DEFAULT_SYSTEM_DISPLAY,
  SYSTEM_DISPLAY_DETAIL,
  SYSTEM_DISPLAY_SOURCE,
} from "../constants/systemConstants";

// Display mode ("SOURCE" | "DETAIL") of a system instance in one editor
// ("in2d" | "in3d"), read on its source annotation.
export default function getSystemDisplayMode(sourceAnnotation, editorKey) {
  const mode = sourceAnnotation?.systemDisplay?.[editorKey];
  if (mode === SYSTEM_DISPLAY_SOURCE || mode === SYSTEM_DISPLAY_DETAIL)
    return mode;
  return DEFAULT_SYSTEM_DISPLAY[editorKey] ?? SYSTEM_DISPLAY_SOURCE;
}
