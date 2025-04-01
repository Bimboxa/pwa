import {orange, red, blue, green, grey, purple} from "@mui/material/colors";

const exampleAppConfig = {
  remoteProjectsContainers: [
    {
      service: "DROPBOX",
      name: "Dropbox",
      path: "/1 = Client DB/LEI/1 = Dossiers",
    },
  ],

  strings: {
    project: {
      createLabel: "Créer un dossier",
    },
  },
  entityModelsObject: {
    projectData: {
      key: "projectData",
      type: "KEY_VALUE",
    },
    map: {
      key: "map",
      type: "MAP",
      strings: {
        labelNew: "Nouveau fond de plan",
      },
      labelKey: "label",
      fieldsObject: {
        label: {
          key: "label",
          type: "text",
          label: "Nom",
        },
        image: {
          key: "image",
          type: "image",
          label: "Image",
        },
      },
    },
    zone: {
      key: "zone",
      type: "ZONE_ENTITY_MODEL",
      strings: {
        labelNew: "Nouvelle pièce",
      },
    },
    material: {
      key: "material",
      strings: {
        labelNew: "Nouveau matériau",
      },
      labelKey: "description",
      fieldsObject: {
        description: {
          key: "description",
          type: "text",
          label: "Description",
        },
        photo: {
          key: "photo",
          type: "image",
          label: "Image",
        },
        zones: {
          key: "zones",
          type: "zones",
          label: "Pièces",
        },
      },
    },
    comment: {
      key: "comment",
      type: "locatedEntityModel",
      strings: {
        labelNew: "Nouveau commentaire",
      },
      labelKey: "text",
      fieldsObject: {
        text: {
          key: "text",
          type: "text",
          label: "Description",
          options: {
            multiline: true,
          },
        },
        image: {
          key: "image",
          type: "image",
          label: "Image",
        },
      },
    },
    sample: {
      type: "LOCATED_ENTITY",
      key: "sample",
      label: "Prélèvement",
      strings: {
        labelNew: "Nouveau prélèvement",
      },
      labelKey: "num",
      fieldsObject: {
        num: {
          key: "num",
          label: "Numéro",
          type: "text",
          options: {
            autoFocus: true,
            increment: "auto",
          },
        },
        photo: {
          key: "photo",
          label: "Photo",
          type: "image",
          options: {
            autoFocus: true,
            variant: "auto",
          },
        },
      },
    },
    inspection: {
      type: "locatedEntityModel",
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
    laboOrder: {
      label: "Commande labo",
      type: "ENTITY_PROPS",
      labelKey: "order",
      actionsTemplate: {
        type: "SELECT_OPTIONS",
        optionKey: "order",
      },
      props: {
        order: {
          key: "order",
          type: "options",
        },
      },
    },
  },
  presetListingsMap: {
    projectDataset: {
      key: "projectDataset",
      name: "Affaire",
      entityModelKey: "projectData",
      color: grey[900],
      iconKey: "dataObject",
      formTemplate: {
        fields: [
          {
            key: "name",
            label: "Nom de l'affaire",
            type: "text",
          },
          {
            key: "address",
            label: "Adresse",
            type: "text",
            options: {
              multiline: true,
            },
          },
        ],
      },
    },
    mapsFromPhotos: {
      key: "mapsFromPhotos",
      name: "Fonds de plan (photos)",
      entityModelKey: "map",
      color: purple[700],
      iconKey: "map",
    },
    mapsFromPdf: {
      key: "mapsFromPdf",
      name: "Fonds de plan (pdf archi)",
      entityModelKey: "map",
      color: purple[900],
      iconKey: "map",
    },
    zones: {
      key: "zones",
      name: "Pièces",
      entityModelKey: "zone",
      color: red[300],
      iconKey: "room",
    },
    materials: {
      name: "Matériaux",
      entityModelKey: "material",
      color: orange[300],
      iconKey: "material",
      zoningKey: "zones", // we don't know yet the listingId of the zones.
    },
    samples: {
      key: "samples",
      name: "Prélèvements",
      entityModelKey: "sample",
      color: blue[700],
      iconKey: "sample",
      sortBy: {
        key: "num",
        order: "desc",
      },
    },
    observations: {
      name: "Sondages",
      entityModelKey: "observation",
      color: blue[500],
      iconKey: "info",
    },
    locations: {
      name: "Localisations",
      entityModelKey: "location",
      color: blue[300],
      iconKey: "location",
    },
    comments: {
      name: "Commentaires",
      entityModelKey: "comment",
      color: red[800],
      iconKey: "comment",
    },
    laboOrders: {
      key: "laboOrders",
      name: "Commandes labo",
      entityModelKey: "laboOrder",
      color: green[900],
      iconKey: "shoppingCart",
      targetKeys: ["samples"],
    },
  },
  presetScopesObject: {
    presetDebug: {
      key: "presetDebug",
      name: "Debug",
      listings: [
        "projectDataset",
        "mapsFromPhotos",
        "mapsFromPdf",
        "zones",
        "materials",
        "samples",
        "laboOrders",
      ],
    },
    preset1: {
      key: "preset1",
      name: "Diagnostic amiante",
      description: "Enregistrer vos prélèvements et sondages",
      listings: [
        "zones",
        "materials",
        "samples",
        "observations",
        "locations",
        "comments",
      ],
    },
    preset2: {
      key: "preset2",
      name: "Notes libres",
      description: "Enregistrer vos commentaires",
      listings: ["comments"],
    },
    preset3: {
      key: "DEFAULT",
      name: "Lot vide",
      listings: [],
    },
  },
};

export default exampleAppConfig;
