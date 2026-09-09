// Fallback entityModel for BUSINESS_OBJECT listings. Org appConfig YAMLs
// replace the default config entirely (no merge), so business-object listings
// must not depend on appConfig: the entityModel is denormalized onto the
// listing at creation.
export const BUSINESS_OBJECT_ENTITY_MODEL = {
  key: "businessObject",
  name: "Ouvrages",
  type: "BUSINESS_OBJECT",
  defaultTable: "businessObjects",
  defaultListingName: "Ouvrages",
  strings: {
    labelNew: "Nouvelle liste d'ouvrages",
  },
};

// Quantity units: u / ml / m². The unit drives the default rollup rule of the
// linked annotations' quantities (U → count, L → length, S → surface).
export const BUSINESS_OBJECT_UNITS = [
  { key: "U", label: "u" },
  { key: "L", label: "ml" },
  { key: "S", label: "m²" },
];

export const DEFAULT_BUSINESS_OBJECT_UNIT = "U";

// Display mode of a task's hours ratio (PLANNING type): RATIO = hours per
// unit (the stored hoursRatio), CADENCE = units per hour (1 / ratio, a view
// only — switching the mode never rewrites the stored ratio).
export const HOURS_RATIO_MODES = [
  { key: "RATIO", label: "Ratio" },
  { key: "CADENCE", label: "Cadence" },
];

export const DEFAULT_HOURS_RATIO_MODE = "RATIO";

// Unit of a task's hours ratio (PLANNING), stored in `hoursRatioUnit`. Tasks
// have no quantity unit of their own — `unit` belongs to priced articles
// (DPGF-like ouvrages) — so the ratio carries its own unit: u / ml / m²,
// m² by default (h/m² being the usual planning input).
export const DEFAULT_HOURS_RATIO_UNIT = "S";

export const DEFAULT_BUSINESS_OBJECT_COLOR = "#00695c";
