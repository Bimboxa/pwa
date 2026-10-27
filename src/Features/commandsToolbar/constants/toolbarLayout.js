// Display order of the unified commands toolbar — pure UI configuration,
// per module (getToolbarLayout): the editing modules share the DEFAULT
// sections, the BaseMaps module shows its two base map placement commands
// alone. The layout is written as NAMED SECTIONS ({ key, label, entries }),
// the labels feeding the « Raccourcis » dialog (DialogCommandShortcuts); the
// toolbar renders the flat form (getToolbarLayout), sections separated by a
// divider. Entries of a section:
//   "COMMAND_KEY"                               one button (CommandSlot)
//   { type: "group", key, label, commandKeys }  split button: the last-used
//     command of the group as primary slot, the others in its menu.
// A command with `variants` (Ouverture, Coupe face…) is a split button on its
// own. Every command of the registry must appear in at least one layout, at
// most once per layout (asserted in dev by commands/index.js). The code stays
// one folder per command: a section / group only decides how the buttons are
// packed on screen.
//
// Sections, from the scene context to the quality tools: frame → base map →
// draw → lines in a surface → cuts → topological cuts → faces → create /
// modify from the selection → move / view of one annotation → quality.
// The registry order (commands/index.js) drives the hotkey resolution and is
// independent from this display order.

// user frame (3D editor): orient / show / reset the axes
const AXES_SECTION = {
  key: "AXES",
  label: "Repère",
  entries: [
    {
      type: "group",
      key: "AXES",
      label: "Repère",
      commandKeys: ["PLACE_AXES", "TOGGLE_AXES", "RESET_AXES"],
    },
  ],
};

// base map placement (3D editor)
const BASE_MAP_SECTION = {
  key: "BASE_MAP",
  label: "Fond de plan",
  entries: ["MOVE_BASE_MAP", "ROTATE_BASE_MAP"],
};

const DEFAULT_SECTIONS = [
  AXES_SECTION,
  BASE_MAP_SECTION,
  // « Dessin » — the templateless annotation types (the point-like types and
  // the measures packed as split buttons, point / cote as default slot),
  // then the revolution axis
  {
    key: "DRAW",
    label: "Dessin",
    entries: [
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
    ],
  },
  // lines added inside the selected surface (the guide line and the layout
  // line stand alone, outside the group)
  {
    key: "SURFACE_LINES",
    label: "Lignes dans une surface",
    entries: [
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
    ],
  },
  // cuts: openings, segment cuts, surface / face cuts
  {
    key: "CUTS",
    label: "Coupes",
    entries: [
      "CUT",
      "SPLIT_POLYLINE_CLICK",
      "SPLIT_LINE",
      "ISOLATE_SEGMENT",
      "SURFACE_CUT",
      "FACE_CUT",
    ],
  },
  // topological cuts: subtraction, hollow out
  {
    key: "TOPO_CUTS",
    label: "Soustraction / Évidement",
    entries: [
      {
        type: "group",
        key: "SUBTRACT",
        label: "Soustraction",
        commandKeys: ["SUBTRACT", "SUBTRACT_FROM"],
      },
      "HOLLOW_OUT",
    ],
  },
  // faces (3D editor)
  {
    key: "FACES",
    label: "Faces (3D)",
    entries: ["EXTRUDE", "ISOLATE_FACE", "MERGE_FACES"],
  },
  // create / modify from the selected annotations
  {
    key: "SELECTION",
    label: "Créer / modifier depuis la sélection",
    entries: [
      "CHANGE_STYLE",
      "CLONE",
      "MERGE",
      "JOIN_ANNOTATIONS",
      "DILATE",
      "SPLIT_IN_SEGMENTS",
      "SETTING_OUT",
      "CONVERT",
      "REENTRANT_ANGLES",
      // « Inverser le sens » stands alone, always visible next to the group
      {
        type: "group",
        key: "LINE_EDIT",
        label: "Ligne / bande",
        commandKeys: [
          "TOGGLE_STRIP_TYPE",
          "TOGGLE_CLOSE_LINE",
          "FLIP_EXTRUSION",
          "ANCHOR",
          "DETECT_SIMILAR_STRIPS",
        ],
      },
      "FLIP_STRIP",
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
    ],
  },
  // move / rotate one annotation + view toggles of the 2D editor
  {
    key: "MOVE_VIEW",
    label: "Déplacer / Affichage",
    entries: [
      "MOVE_ANNOTATION",
      "ROTATE_ANNOTATION",
      "WRAPPER_MODE",
      "TOGGLE_SEGMENT_COTES",
      "TOGGLE_SEGMENT_DRAG",
      "TOGGLE_ANGLES_LOCKED",
    ],
  },
  // quality: duplicates detection, cleanup (the deleted-annotations purge of
  // the scope + the geometry repair of the selected line / surface),
  // geometry simplification, arcs detection
  {
    key: "QUALITY",
    label: "Qualité",
    entries: [
      "DETECT_DUPLICATES",
      {
        type: "group",
        key: "CLEANUP",
        label: "Nettoyage",
        commandKeys: ["CLEAN", "REPAIR"],
      },
      "SIMPLIFY",
      "ARCIFY",
    ],
  },
];

// « Fonds de plan » module: the user frame group and the base map placement
// commands only, in the same order as the default sections.
const BASE_MAPS_SECTIONS = [AXES_SECTION, BASE_MAP_SECTION];

// Flat form rendered by the toolbar: the entries of every section, a
// { type: "divider" } between two sections.
function flattenSections(sections) {
  return sections.flatMap((section, index) =>
    index === 0 ? section.entries : [{ type: "divider" }, ...section.entries]
  );
}

// Command keys of a flat layout (strings + the groups' commandKeys), in
// display order.
export function getLayoutCommandKeys(layout) {
  return layout.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry?.type === "group") return entry.commandKeys;
    return [];
  });
}

export const TOOLBAR_SECTIONS = {
  DEFAULT: DEFAULT_SECTIONS,
  BASE_MAPS: BASE_MAPS_SECTIONS,
};

export const TOOLBAR_LAYOUTS = {
  DEFAULT: flattenSections(DEFAULT_SECTIONS),
  BASE_MAPS: flattenSections(BASE_MAPS_SECTIONS),
};

export function getToolbarSections(moduleKey) {
  return moduleKey === "BASE_MAPS"
    ? TOOLBAR_SECTIONS.BASE_MAPS
    : TOOLBAR_SECTIONS.DEFAULT;
}

export default function getToolbarLayout(moduleKey) {
  return moduleKey === "BASE_MAPS"
    ? TOOLBAR_LAYOUTS.BASE_MAPS
    : TOOLBAR_LAYOUTS.DEFAULT;
}
