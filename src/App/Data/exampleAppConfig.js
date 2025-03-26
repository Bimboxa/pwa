import {orange, red, blue} from "@mui/material/colors";

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
      type: "locatedEntityModel",
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
  },
  presetListingsMap: {
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
      name: "Prélèvements",
      entityModelKey: "sample",
      color: blue[700],
      iconKey: "sample",
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
  },
  presetScopesObject: {
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
