import {red} from "@mui/material/colors";

const appConfigDefault = {
  name: "Configuration par défaut",
  version: "v1",
  strings: {
    general: {
      projectAndScope: "Périmètre des données",
      select: "Sélectionnez un projet",
    },
    project: {
      nameSingular: "Affaire",
      namePlural: "Affaires",
      seeAll: "Toutes les affaires",
      new: "Nouvelle affaire",
      create: "Créez une nouvelle affaire",
      select: "Sélectionnez une affaire",
      noProject: "Aucune affaire",
    },
    scope: {
      nameSingular: "Projet",
      namePlural: "Projets",
      seeAll: "Tous les projets",
      new: "Nouveau projet",
      create: "Créez un nouveau projet",
      select: "Sélectionnez un projet",
      noScope: "Aucun projet",
    },
    presetConfig: {
      title: "Mission",
      select: "Sélectionnez une mission",
    },
  },
  creation: {
    canCreateProject: true,
    canCreateScope: true,
  },
  entityModelsObject: {
    comment: {
      key: "comment",
      type: "LOCATED_ENTITY",
      strings: {
        labelNew: "Nouveau commentaire",
      },
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
      sortBy: {
        key: "createdAt",
        order: "desc",
      },
    },
  },
  presetListingsObject: {
    comments: {
      name: "Commentaires",
      entityModelKey: "comment",
      table: "entities",
      color: red["800"],
      iconKey: "comment",
    },
  },
  presetScopesObject: {
    preset1: {
      key: "preset1",
      name: "Configuration par défaut",
      description: "Configuration d'un projet par défaut",
      listings: ["observations"],
    },
  },
};

export default appConfigDefault;
