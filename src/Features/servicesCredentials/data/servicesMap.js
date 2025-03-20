const servicesMap = new Map();

const dropboxService = {
  name: "Dropbox",
  credentialsMetadata: [
    {
      label: "App secret",
      key: "dropboxAppSecret",
    },
  ],
};

servicesMap.set("DROPBOX", dropboxService);

export default servicesMap;
