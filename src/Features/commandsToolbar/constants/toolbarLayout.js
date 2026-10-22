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
//
// Blocks, from the scene context to the quality tools: frame → base map →
// draw → lines in a surface → cuts → topological cuts → faces → create /
// modify from the selection → move / view of one annotation → quality.
// The registry order (commands/index.js) drives the hotkey resolution and is
// independent from this display order.
const DEFAULT_LAYOUT = [
  // user frame (3D editor): orient / show / reset the axes
  {
    type: "group",
    key: "AXES",
    label: "Repère",
    commandKeys: ["PLACE_AXES", "TOGGLE_AXES", "RESET_AXES"],
  },
  { type: "divider" },
  // base map placement (3D editor)
  "MOVE_BASE_MAP",
  "ROTATE_BASE_MAP",
  { type: "divider" },
  // « Dessin » — the templateless annotation types (the point-like types and
  // the measures packed as split buttons, point / cote as default slot),
  // then the revolution axis
  "DRAW_POLYLINE",
  "DRAW_POLYGON",
  "DRAW_DISC",
  {
    type: "group",
    key: "DRAW_POINT_LIKE",
    label: "Point / Repère / Étiquette",
    commandKeys: ["DRAW_POINT", "DRAW_MARKER", "DRAW_LABEL"],
  },
  "DRAW_FREE_TEXT",
  "DRAW_DETAIL",
  "DRAW_IMAGE",
  {
    type: "group",
    key: "DRAW_MEASURE",
    label: "Cote / Règle",
    commandKeys: ["DRAW_COTE", "DRAW_RULER"],
  },
  "REVOLUTION_AXIS",
  { type: "divider" },
  // lines added inside the selected surface (the guide line and the layout
  // line stand alone, outside the group)
  {
    type: "group",
    key: "POLYGON_LINES",
    label: "Lignes dans une surface",
    commandKeys: [
      "ADD_SLOPE",
      "AUTO_SLOPE",
      "ADD_ISO_HEIGHT_LINE",
      "ADD_PROFILE_LINE",
    ],
  },
  "ADD_GUIDE_LINE",
  "ADD_LAYOUT_LINE",
  { type: "divider" },
  // cuts: openings, segment cuts, surface / face cuts
  "CUT",
  "SPLIT_POLYLINE_CLICK",
  "SPLIT_LINE",
  "ISOLATE_SEGMENT",
  "SURFACE_CUT",
  "FACE_CUT",
  { type: "divider" },
  // topological cuts: subtraction, hollow out
  {
    type: "group",
    key: "SUBTRACT",
    label: "Soustraction",
    commandKeys: ["SUBTRACT", "SUBTRACT_FROM"],
  },
  "HOLLOW_OUT",
  { type: "divider" },
  // faces (3D editor)
  "EXTRUDE",
  "ISOLATE_FACE",
  "MERGE_FACES",
  { type: "divider" },
  // create / modify from the selected annotations
  "CLONE",
  "MERGE",
  "JOIN_ANNOTATIONS",
  "DILATE",
  "SPLIT_IN_SEGMENTS",
  "SETTING_OUT",
  "CONVERT",
  "REENTRANT_ANGLES",
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
  // move / rotate one annotation + view toggles of the 2D editor
  "MOVE_ANNOTATION",
  "ROTATE_ANNOTATION",
  "WRAPPER_MODE",
  "TOGGLE_SEGMENT_COTES",
  "TOGGLE_SEGMENT_DRAG",
  "TOGGLE_ANGLES_LOCKED",
  { type: "divider" },
  // quality: duplicates detection, cleanup (the deleted-annotations purge of
  // the scope + the geometry repair of the selected line / surface),
  // geometry simplification, arcs detection
  "DETECT_DUPLICATES",
  {
    type: "group",
    key: "CLEANUP",
    label: "Nettoyage",
    commandKeys: ["CLEAN", "REPAIR"],
  },
  "SIMPLIFY",
  "ARCIFY",
];

// « Fonds de plan » module: the user frame group and the base map placement
// commands only, in the same order as DEFAULT_LAYOUT.
const BASE_MAPS_LAYOUT = [
  {
    type: "group",
    key: "AXES",
    label: "Repère",
    commandKeys: ["PLACE_AXES", "TOGGLE_AXES", "RESET_AXES"],
  },
  { type: "divider" },
  "MOVE_BASE_MAP",
  "ROTATE_BASE_MAP",
];

export const TOOLBAR_LAYOUTS = {
  DEFAULT: DEFAULT_LAYOUT,
  BASE_MAPS: BASE_MAPS_LAYOUT,
};

export default function getToolbarLayout(moduleKey) {
  return moduleKey === "BASE_MAPS" ? BASE_MAPS_LAYOUT : DEFAULT_LAYOUT;
}
