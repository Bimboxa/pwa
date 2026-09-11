// Preserve the legacy preset's key, listings and base-map defaults in the
// configuration selector alongside the initialization configuration.
const DIAG_AMIANTE_NFX_46_020 = {
  key: "preset1",
  name: "Diag amiante - NFX_46_020",
  description: "Enregistrer vos prélèvements et sondages",
  code: "NFX_46_020",
  chipLabel: "Diagnostic amiante",
  keywords: { type: ["Diagnostic amiante"] },
  baseMaps: {
    disableExistingListings: false,
    listings: [
      { name: "Vues en plan", fallback: true, items: [] },
      {
        name: "Coupes & élévations",
        verticalBaseMaps: true,
        fallback: true,
        items: [],
      },
    ],
  },
  annotations: {
    libraryKeys: [
      "zones",
      "nom_NFX_46_020",
      "materials",
      "samples",
      "observations",
      "shapes",
    ],
    initSystemAnnotationTemplates: true,
  },
};

export default DIAG_AMIANTE_NFX_46_020;
