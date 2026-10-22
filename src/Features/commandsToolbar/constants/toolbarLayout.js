// Display order of the unified commands toolbar — pure UI configuration,
// per module (getToolbarLayout): the editing modules share DEFAULT_LAYOUT,
// the BaseMaps module shows its two base map placement commands alone.
// Entries:
//   "COMMAND_KEY"                               one button (CommandSlot)
//   { type: "divider" }                         separator
//   { type: "group", key, label, commandKeys }  split button: the last-used
//     command of the group as primary slot, the others in its menu.
// A command with `variants` (Ouverture, Coupe face…) is a split button on its
// own. Every command of the registry must appear in at least one layout, at
// most once per layout (asserted in dev by commands/index.js). The code stays one folder per command: a group
// only decides how the buttons are packed on screen.
const DEFAULT_LAYOUT = [
  // « Dessin » — the templateless annotation types, one button each
  { type: "divider" },
  "DRAW_POLYLINE",
  "DRAW_POLYGON",
  "DRAW_DISC",
  "DRAW_MARKER",
  "DRAW_POINT",
  "DRAW_LABEL",
  "DRAW_FREE_TEXT",
  "DRAW_DETAIL",
  "DRAW_IMAGE",
  "DRAW_COTE",
  "DRAW_RULER",
  { type: "divider" },
  // drawing tools
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
  "DETECT_DUPLICATES",
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
  // cleanup: the deleted-annotations purge of the scope (default) + the
  // geometry repair of the selected line / surface
  {
    type: "group",
    key: "CLEANUP",
    label: "Nettoyage",
    commandKeys: ["CLEAN", "REPAIR"],
  },
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
  "ASSIGN_BUSINESS_OBJECT",
  { type: "divider" },
  // view toggles of the 2D editor
  "TOGGLE_SEGMENT_COTES",
  "TOGGLE_SEGMENT_DRAG",
  "TOGGLE_ANGLES_LOCKED",
  { type: "divider" },
  // base map placement (3D editor)
  "MOVE_BASE_MAP",
  "ROTATE_BASE_MAP",
  { type: "divider" },
  // user frame (3D editor): orient / show / reset the axes
  {
    type: "group",
    key: "AXES",
    label: "Repère",
    commandKeys: ["PLACE_AXES", "TOGGLE_AXES", "RESET_AXES"],
  },
];

// « Fonds de plan » module: the base map placement commands and the user
// frame group only.
const BASE_MAPS_LAYOUT = [
  "MOVE_BASE_MAP",
  "ROTATE_BASE_MAP",
  { type: "divider" },
  {
    type: "group",
    key: "AXES",
    label: "Repère",
    commandKeys: ["PLACE_AXES", "TOGGLE_AXES", "RESET_AXES"],
  },
];

export const TOOLBAR_LAYOUTS = {
  DEFAULT: DEFAULT_LAYOUT,
  BASE_MAPS: BASE_MAPS_LAYOUT,
};

export default function getToolbarLayout(moduleKey) {
  return moduleKey === "BASE_MAPS" ? BASE_MAPS_LAYOUT : DEFAULT_LAYOUT;
}
