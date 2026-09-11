const DIAG_AMIANTE_INIT = {
  key: "DIAG_AMIANTE_INIT",
  name: "Diag amiante - init",
  description: "Dessiner les fonds de plan et repérer les ouvrages amiantés.",
  code: "AMIANTE.INIT",
  chipLabel: "Diagnostic amiante",
  keywords: { type: ["Diagnostic amiante"] },
  scopeConfig: {
    enabledModuleKeys: [
      "BUSINESS_OBJECTS_LOCATIONS",
      "BUSINESS_OBJECTS_NOMENCLATURE",
      "BUSINESS_OBJECTS",
      "BUSINESS_OBJECTS_PINNED_OBJECTS",
    ],
    moduleOrder: [
      "BASE_MAPS",
      "MAP",
      "BUSINESS_OBJECTS_LOCATIONS",
      "BUSINESS_OBJECTS_NOMENCLATURE",
      "BUSINESS_OBJECTS",
      "BUSINESS_OBJECTS_PINNED_OBJECTS",
    ],
    moduleLabelsByKey: {
      BUSINESS_OBJECTS: "Matériaux",
      BUSINESS_OBJECTS_PINNED_OBJECTS: "Prélèvements & sondages",
    },
    moduleIconKeysByKey: {
      BUSINESS_OBJECTS: "category",
      BUSINESS_OBJECTS_NOMENCLATURE: "accountTree",
      BUSINESS_OBJECTS_PINNED_OBJECTS: "locationOn",
      BUSINESS_OBJECTS_LOCATIONS: "floorPlan",
    },
  },
  baseMaps: {
    disableExistingListings: false,
    listings: [{ name: "Fonds de plan", fallback: true, items: [] }],
  },
  annotations: {
    libraryKeys: ["ASBESTOS_BASE_MAP_DRAWING", "ASBESTOS_ELEMENTS"],
    initSystemAnnotationTemplates: false,
  },
};

export default DIAG_AMIANTE_INIT;
