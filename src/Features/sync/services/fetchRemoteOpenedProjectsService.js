import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

import fetchFileDropboxService from "Features/dropbox/services/fetchFileDropboxService";

export default async function fetchRemoteOpenedProjectsService({
  remoteProvider,
  remoteContainer,
}) {
  if (!remoteProvider) {
    console.error("No remoteProvider available");
    return;
  }

  const {service} = remoteContainer;

  switch (service) {
    case "DROPBOX":
      const path = remoteContainer.path + "/_data/_openedProjects.json";
      console.log("[FETCH] file : path", path);
      const jsonFile = await remoteProvider.downloadFile(path);
      const response = await jsonFileToObjectAsync(jsonFile);

      return response.items;
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}
