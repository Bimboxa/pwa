// Display order of the unified commands toolbar — pure UI configuration.
// Entries:
//   "COMMAND_KEY"                               one button (CommandSlot)
//   { type: "divider" }                         vertical separator
//   { type: "group", key, label, commandKeys }  split button: the last-used
//     command of the group as primary slot, the others in its menu.
// A command with `variants` (Ouverture…) is a split button on its own.
// Every command of the registry must appear exactly once (asserted in dev by
// commands/index.js). The code stays one folder per command: a group only
// decides how the buttons are packed on screen.
const TOOLBAR_LAYOUT = [
  "DRAW",
  "CUT",
  "REVOLUTION_AXIS",
  { type: "divider" },
  "SPLIT_LINE",
  "SPLIT_POLYLINE_CLICK",
  "ISOLATE_SEGMENT",
  "SURFACE_CUT",
  "JOIN_ANNOTATIONS",
  "FACE_CUT",
  "ISOLATE_FACE",
  "MERGE_FACES",
  "EXTRUDE",
  { type: "divider" },
  "MOVE_ANNOTATION",
  "ROTATE_ANNOTATION",
];

export default TOOLBAR_LAYOUT;
