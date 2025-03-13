const projectConfigExample = {
  name: "Résidence Valsonn - W007L",
  remoteFolder: {
    type: "box",
    folderId: "",
  },
  organisationNomenclatures: ["nfx_46_020"],
  zonesListingKey: "bat_4",
  productEntityModels: [
    {
      key: "material",
      label: "Produit / Matériau",
      fields: {
        name: {
          key: "name",
          label: "Désignation",
          type: "text",
        },
        code: {
          key: "code",
          label: "Code",
          type: "text",
        },
        color: {
          key: "color",
          label: "Couleur",
          type: "color",
        },
        categoryId: {
          key: "categoryId",
          label: "Catégorie",
          type: "category",
          nomenclature: "nfx_46_020",
        },
        categoryPrefix: {
          key: "categoryPrefix",
          label: "Préfixe Catégorie",
          type: "optionText",
          optionsFromField: {
            key: "categoryId",
          },
        },
        categoryCode: {
          key: "categoryCode",
          label: "Code Catégorie",
          type: "text",
        },
        fwc: {
          key: "fwc",
          label: "Sol/Mur/Plafond",
          type: "optionsObject",
          options: [
            {key: "floor", label: "Sol"},
            {key: "wall", label: "Mur"},
            {key: "ceiling", label: "Plafond"},
          ],
        },
      },
      formView: [
        {
          tabName: "Info",
          fields: [
            {section: "Identification"},
            {key: "name"},
            {key: "code"},
            {key: "color"},
            {section: "Catégorie"},
            {key: "categoryId"},
            {key: "categoryPrefix"},
            {key: "categoryCode"},
            {key: "categoryId"},
            {section: "Localisation"},
            {key: "fwc"},
          ],
        },
      ],
    },
  ],
  locatedEntityModels: [
    {
      key: "sample",
      label: "Prélèvement",
      fields: {
        num: {
          key: "num",
          type: "text",
          options: {
            increment: "auto",
          },
        },
        photo: {
          key: "photo",
          type: "image",
          options: {
            variant: "auto",
          },
        },
      },
    },
    {
      key: "inspection",
      label: "Sondage",
      fields: {
        num: {
          key: "num",
          type: "text",
          options: {
            increment: "auto",
          },
        },
        photo: {
          key: "photo",
          type: "image",
          options: {
            variant: "auto",
          },
        },
      },
    },
    {
      key: "location",
      label: "Localisation",
    },
  ],
};
