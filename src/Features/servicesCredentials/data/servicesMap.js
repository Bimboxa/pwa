const servicesMap = new Map();

const dropboxService = {
  serviceName: "Dropbox",
  credentialsMetadata: [
    {
      key: "dropboxAppSecret",
      label: "App secret",
      prefix: "userEmailDomain",
    },
  ],
};

servicesMap.set("DROPBOX", dropboxService);

export default servicesMap;
