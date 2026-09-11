const DIAG_AMIANTE_INIT = {
  key: "DIAG_AMIANTE_INIT",
  name: "Diag amiante - init",
  description: "Dessiner les fonds de plan et repérer les ouvrages amiantés.",
  code: "AMIANTE.INIT",
  chipLabel: "Diagnostic amiante",
  keywords: { type: ["Diagnostic amiante"] },
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
