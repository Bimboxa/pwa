// Display order of the unified commands toolbar — pure UI configuration.
// Entries:
//   "COMMAND_KEY"                               one button (CommandSlot)
//   { type: "divider" }                         separator
//   { type: "group", key, label, commandKeys }  split button: the last-used
//     command of the group as primary slot, the others in its menu.
// A command with `variants` (Ouverture, Coupe face…) is a split button on its
// own. Every command of the registry must appear exactly once (asserted in
// dev by commands/index.js). The code stays one folder per command: a group
// only decides how the buttons are packed on screen.
const TOOLBAR_LAYOUT = [
  // drawing tools
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
  // transforms of the selection
  "MOVE_ANNOTATION",
  "ROTATE_ANNOTATION",
  "WRAPPER_MODE",
  "CLONE",
  "MERGE",
  "DILATE",
  "SPLIT_IN_SEGMENTS",
  "SETTING_OUT",
  "CONVERT",
  "REENTRANT_ANGLES",
  "CLEAN_SEGMENTS",
  "CURVATURE",
  { type: "divider" },
  // geometry of one annotation
  {
    type: "group",
    key: "LINE_EDIT",
    label: "Ligne / bande",
    commandKeys: [
      "TOGGLE_STRIP_TYPE",
      "TOGGLE_CLOSE_LINE",
      "FLIP_STRIP",
      "FLIP_EXTRUSION",
      "ANCHOR",
      "DETECT_SIMILAR_STRIPS",
    ],
  },
  "REPAIR",
  "SIMPLIFY",
  "ARCIFY",
  "HOLLOW_OUT",
  {
    type: "group",
    key: "SUBTRACT",
    label: "Soustraction",
    commandKeys: ["SUBTRACT", "SUBTRACT_FROM"],
  },
  {
    type: "group",
    key: "POLYGON_LINES",
    label: "Lignes dans une surface",
    commandKeys: [
      "ADD_GUIDE_LINE",
      "ADD_SLOPE",
      "AUTO_SLOPE",
      "ADD_ISO_HEIGHT_LINE",
      "ADD_PROFILE_LINE",
      "ADD_LAYOUT_LINE",
    ],
  },
  {
    type: "group",
    key: "WALLS",
    label: "Murs",
    commandKeys: [
      "VECTORISE",
      "CONTOURS",
      "CLOSE_ENVELOPE",
      "CLOSE_WALL_FOOTPRINT",
      "AUTO_WALLS",
      "SLOPE_WALLS",
    ],
  },
  "ASSIGN_ZONE",
  "ASSIGN_BUSINESS_OBJECT",
  { type: "divider" },
  // view toggles of the 2D editor
  "TOGGLE_SEGMENT_COTES",
  "TOGGLE_SEGMENT_DRAG",
  "TOGGLE_ANGLES_LOCKED",
];

export default TOOLBAR_LAYOUT;
