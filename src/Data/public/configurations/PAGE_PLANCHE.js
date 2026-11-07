const PAGE_PLANCHE = {
  key: "PAGE_PLANCHE",
  name: "Page planche",
  description:
    "Une page A3 paysage et la bibliothèque Générique pour dessiner librement.",
  code: "PLANCHE",
  chipLabel: "Générique",
  keywords: { type: ["Générique"] },
  baseMaps: {
    disableExistingListings: false,
    listings: [
      {
        name: "Planches",
        items: [
          {
            type: "BLANK_PAGE",
            name: "Planche 1",
            pageFormat: "A3",
            pageOrientation: "LANDSCAPE",
            scale: 50,
          },
        ],
      },
    ],
  },
  annotations: { libraryKeys: ["DEFAULT"] },
  scopeConfig: { enabledModuleKeys: ["THREED"] },
};

export default PAGE_PLANCHE;
