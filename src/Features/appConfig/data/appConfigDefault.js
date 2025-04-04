const appConfigDefault = {
  name: "Configuration par défaut",
  strings: {
    general: {
      projectAndScope: "Périmètre des données",
    },
    project: {
      nameSingular: "Projet",
      namePlural: "Projets",
      seeAll: "Tous les projets",
      new: "Nouveau projet",
      create: "Créez un nouveau projet",
    },
    scope: {
      nameSingular: "Sous-projet",
      namePlural: "Sous-projets",
      seeAll: "Tous les sous-projets",
      new: "Nouveau sous-projet",
      create: "Créez un nouveau sous-projet",
    },
    presetConfig: {
      title: "Mission",
      select: "Sélectionnez une mission",
    },
  },
  remoteContainers: [
    {
      service: "DROPBOX",
      name: "Dropbox",
      path: "/1 = Client DB/LEI/1 = Dossiers",
      clientId: "t3in2phwzao0ph6",
    },
    {
      service: "GOOGLE_DRIVE",
      name: "Google Drive",
    },
  ],
  remoteProjectsContainers: [
    {
      service: "DROPBOX",
      name: "Dropbox",
      path: "/1 = Client DB/LEI/1 = Dossiers",
    },
    {
      service: "GOOGLE_DRIVE",
      name: "Google Drive",
    },
  ],
};

export default appConfigDefault;
