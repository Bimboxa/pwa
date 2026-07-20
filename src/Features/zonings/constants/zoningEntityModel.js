// Fallback entityModel for ZONING listings. Org appConfig YAMLs replace the
// default config entirely (no merge), so zoning listings must not depend on
// appConfig: the entityModel is denormalized onto the listing at creation.
export const ZONING_ENTITY_MODEL = {
  key: "zoning",
  name: "Zonage",
  type: "ZONING",
  defaultTable: "zones",
  defaultListingName: "Zonage",
  strings: {
    labelNew: "Nouveau zonage",
  },
};

export const DEFAULT_ZONE_COLOR = "#8e24aa";
