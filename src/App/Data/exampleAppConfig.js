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
    location: {
      key: "location",
      type: "LOCATION_ENTITY_MODEL",
      color: red[300],
      iconKey: "room",
      strings: {
        labelNew: "Nouvelle pièce",
      },
    },
    comment: {
      key: "comment",
      color: red[500],
      iconKey: "comment",
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
      entityModelKey: "locations",
      color: blue[300],
      iconKey: "location",
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
