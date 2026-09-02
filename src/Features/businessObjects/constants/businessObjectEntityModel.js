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

export const DEFAULT_BUSINESS_OBJECT_COLOR = "#00695c";
