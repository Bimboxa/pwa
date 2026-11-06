// Display order of the unified commands toolbar — pure UI configuration,
// per module (getToolbarLayout): the editing modules share the DEFAULT
// sections, the BaseMaps module shows its two base map placement commands
// alone. The layout is written as NAMED SECTIONS ({ key, label, entries }),
// the labels feeding the « Commandes » dialog (DialogCommands); the
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

// editor grid (2D editor): metric grid over the base map, snap target —
// always the very first command of the toolbar
const GRID_SECTION = {
  key: "GRID",
  label: "Grille",
  entries: ["TOGGLE_GRID"],
};

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
  GRID_SECTION,
  AXES_SECTION,
  BASE_MAP_SECTION,
  // « Dessin » — the templateless annotation types (the point-like types and
  // the measures packed as split buttons, point / cote as default slot),
  // then the revolution axis and its placement on a cut base map
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
      "PLACE_REVOLUTION_AXIS",
    ],
  },
  // lines added inside the selected surface (the guide line, the layout
  // line and the profile stand alone, outside the group)
  {
    key: "SURFACE_LINES",
    label: "Lignes dans une surface",
    entries: [
      {
        type: "group",
        key: "POLYGON_LINES",
        label: "Lignes dans une surface",
        commandKeys: ["ADD_SLOPE", "AUTO_SLOPE", "ADD_ISO_HEIGHT_LINE"],
      },
      "ADD_GUIDE_LINE",
      "ADD_LAYOUT_LINE",
      // standalone (2D + 3D): applying an existing « Profil » annotation on
      // a POLYLINE works from the 3D editor too
      "ADD_PROFILE_LINE",
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
  // faces (3D editor) + the profile sweep along a line (2D / 3D)
  {
    key: "FACES",
    label: "Faces / Extrusion",
    entries: ["EXTRUDE", "EXTRUDE_ALONG_LINE", "ISOLATE_FACE", "MERGE_FACES"],
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
      "ADD_INTERSECTION_POINTS",
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
      // « Contours » stands alone, always visible next to the walls group
      "CONTOURS",
      {
        type: "group",
        key: "WALLS",
        label: "Murs",
        commandKeys: [
          "VECTORISE",
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
      // session hide of annotations / mesh faces + its registry dropdown
      "HIDE_ANNOTATION",
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

// Section marks ("traits de coupe", Features/baseMapLinks): drawn on a plan
// of the « Fonds de plan » module, 2D editor.
const SECTION_LINES_SECTION = {
  key: "SECTION_LINES",
  label: "Coupes / élévations",
  entries: ["DRAW_SECTION_LINE"],
};

// « Fonds de plan » module: the user frame group, the base map placement
// commands (same order as the default sections) and the section marks.
const BASE_MAPS_SECTIONS = [
  GRID_SECTION,
  AXES_SECTION,
  BASE_MAP_SECTION,
  SECTION_LINES_SECTION,
];

// « Maillage » module: the user frame group, the meshing tools (the
// commands taking over from the bottom meshing toolbar — Features/threedMesh)
// and the cut lines drawn to prepare the mailles (Features/threedCutLines).
const MESHES_TOOLS_SECTION = {
  key: "MESHES_TOOLS",
  label: "Mailles",
  entries: ["ADD_MESH"],
};
const CUT_LINES_SECTION = {
  key: "CUT_LINES",
  label: "Lignes de coupe",
  entries: ["DRAW_CUT_LINE"],
};
const MESHES_SECTIONS = [AXES_SECTION, MESHES_TOOLS_SECTION, CUT_LINES_SECTION];

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
  MESHES: MESHES_SECTIONS,
};

export const TOOLBAR_LAYOUTS = {
  DEFAULT: flattenSections(DEFAULT_SECTIONS),
  BASE_MAPS: flattenSections(BASE_MAPS_SECTIONS),
  MESHES: flattenSections(MESHES_SECTIONS),
};

// Layout key of a module: the modules with their own sections, else DEFAULT.
function getLayoutKey(moduleKey) {
  if (moduleKey === "BASE_MAPS") return "BASE_MAPS";
  if (moduleKey === "MESHES") return "MESHES";
  return "DEFAULT";
}

export function getToolbarSections(moduleKey) {
  return TOOLBAR_SECTIONS[getLayoutKey(moduleKey)];
}

// Sections listed by the « Commandes » dialog: the default sections, plus the
// sections that only exist in the current module's layout (Fonds de plan,
// Maillage) — their commands can then be searched and added to the
// right-click shortcuts of that module.
export function getCommandsDialogSections(moduleKey) {
  const defaultKeys = new Set(DEFAULT_SECTIONS.map((section) => section.key));
  const moduleOnly = getToolbarSections(moduleKey).filter(
    (section) => !defaultKeys.has(section.key)
  );
  return moduleOnly.length > 0
    ? [...DEFAULT_SECTIONS, ...moduleOnly]
    : DEFAULT_SECTIONS;
}

export default function getToolbarLayout(moduleKey) {
  return TOOLBAR_LAYOUTS[getLayoutKey(moduleKey)];
}
