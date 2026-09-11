// Code registry of the business object TYPES. Each type is a family of
// business-object listings sharing the same behavior (left drawer panel,
// tools, default label / icon) and gets its own module in the left band:
// key "BUSINESS_OBJECTS" for STANDARD, "BUSINESS_OBJECTS_<TYPE>" otherwise
// (see utils/businessObjectModuleKeys.js). Per scope, db.scopeConfigs can
// override the module label (moduleLabelsByKey), icon (moduleIconKeysByKey),
// activation (disabledModuleKeys) and position (moduleOrder).
//
// Pure data: imported by the scopeConfig selectors and the init services
// (themselves imported by viewersSlice), so it must stay free of JSX / hooks.
// Adding a type = one entry here + one panel line in
// components/PanelBusinessObjectsByType.jsx.

export const DEFAULT_BUSINESS_OBJECT_TYPE_KEY = "STANDARD";

// Wording of the objects of a type (French UI strings, read by the tree,
// the create/edit dialog, the actions menu and the properties panel through
// utils/getBusinessObjectTypeOfListing) and feature flags.
const STANDARD_STRINGS = {
  objectLabel: "Ouvrage",
  newObject: "Nouvel ouvrage",
  // + ` "${parent.label}"`
  newChildPrefix: "Nouveau sous-ouvrage de",
  editObject: "Modifier l'ouvrage",
  addChild: "Ajouter un sous-ouvrage",
  empty: "Aucun ouvrage",
  noLinkedAnnotations: "Aucune annotation liée à cet ouvrage",
  linkTo: "Lier à un ouvrage",
};

// hoursBudget: the objects are TASKS carrying an hours ratio (hoursRatio =
// hours per `unit`); hours budget = linked quantities × ratio, rolled up
// over the sub-tasks (utils/getBusinessObjectHoursBudget).
// color: the objects carry an editable color (row swatch, pickers in the
// form / properties panel). false = the color is neither shown nor editable;
// rows still store DEFAULT_BUSINESS_OBJECT_COLOR (never read).
const STANDARD_FEATURES = { hoursBudget: false, color: true };

const BUSINESS_OBJECT_TYPES = [
  {
    key: "STANDARD",
    defaultLabel: "Ouvrages",
    // Key of viewers/data/moduleIconsMap.js.
    defaultIconKey: "foundation",
    // Ctrl+O — only the STANDARD type carries a module hotkey (the letter
    // namespace is global, see useViewerSwitchHotkeys).
    hotkey: "O",
    // 2D editor = the shared "MAP" instance (like Zones) so entering the
    // module keeps the camera framing; 3D editor = the shared 3D one.
    editors: ["MAP", "THREED"],
    strings: STANDARD_STRINGS,
    features: STANDARD_FEATURES,
  },
  {
    // Category trees (nomenclatures): same tree panel as STANDARD, no
    // module hotkey. Module key BUSINESS_OBJECTS_NOMENCLATURE — unknown to
    // the scopeConfigs rows written before it existed, so it follows the
    // org default (disabled unless listed in defaultEnabledModuleKeys) until
    // the scope enables it (see scopeConfigSelectors knownModuleKeys).
    key: "NOMENCLATURE",
    defaultLabel: "Nomenclatures",
    defaultIconKey: "category",
    editors: ["MAP", "THREED"],
    strings: STANDARD_STRINGS,
    features: STANDARD_FEATURES,
  },
  {
    key: "PINNED_OBJECTS",
    defaultLabel: "Objets localisés",
    defaultIconKey: "pushPin",
    editors: ["MAP", "THREED"],
    strings: STANDARD_STRINGS,
    features: STANDARD_FEATURES,
  },
  {
    key: "LOCATIONS",
    defaultLabel: "Localisations",
    defaultIconKey: "locationOn",
    editors: ["MAP", "THREED"],
    strings: STANDARD_STRINGS,
    features: STANDARD_FEATURES,
  },
  {
    // Planning: hierarchical TASKS carrying an hours ratio. Same tree panel,
    // with the ratio / rolled-up hours in the rows and a total band. Module
    // key BUSINESS_OBJECTS_PLANNING (knownModuleKeys rule, like
    // NOMENCLATURE), no module hotkey.
    key: "PLANNING",
    defaultLabel: "Planning",
    defaultIconKey: "task",
    editors: ["MAP", "THREED"],
    strings: {
      objectLabel: "Tâche",
      newObject: "Nouvelle tâche",
      newChildPrefix: "Nouvelle sous-tâche de",
      editObject: "Modifier la tâche",
      addChild: "Ajouter une sous-tâche",
      empty: "Aucune tâche",
      noLinkedAnnotations: "Aucune annotation liée à cette tâche",
      linkTo: "Lier à une tâche",
    },
    // tasks have no color: name + ratio only
    // workPackages: the panel gets a second tab of work packages (sets of
    // linked annotations × the listing's tasks → hours) and the time
    // planning; tasks carry an optional globalLayerId (annotation partition).
    // annotationListings: the listing properties panel gets the "Liste
    // d'annotations" section — the drawing lists declared as feeding this
    // planning (listing.isForPlanning, declarative only).
    features: {
      hoursBudget: true,
      color: false,
      workPackages: true,
      annotationListings: true,
    },
  },
];

export default BUSINESS_OBJECT_TYPES;

export function getBusinessObjectType(typeKey) {
  return BUSINESS_OBJECT_TYPES.find((t) => t.key === typeKey) ?? null;
}
