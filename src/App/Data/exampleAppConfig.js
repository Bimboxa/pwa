const exampleAppConfig = {
  entityModelsMap: {
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
    location: {
      type: "locatedEntityModel",
      key: "location",
      label: "Localisation",
    },
  },
};

export default exampleAppConfig;
