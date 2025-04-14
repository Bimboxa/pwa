import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import useRemoteContainer from "./useRemoteContainer";
import useRemoteToken from "./useRemoteToken";

import fetchFileDropboxService from "Features/dropbox/services/fetchFileDropboxService";

export default function useFetchRemoteOpenedProjects() {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // main

  const fetch = async () => {
    if (!remoteContainer) {
      throw new Error("No remote container available");
    }

    if (!accessToken) {
      throw new Error("No remote token available");
    }

    const {service} = remoteContainer;

    switch (service) {
      case "DROPBOX":
        const path = remoteContainer.path + "/_data/openedProjects.json";
        console.log("[FETCH] file : path", path);
        const jsonFile = await fetchFileDropboxService({
          accessToken: accessToken,
          path,
        });
        const response = await jsonFileToObjectAsync(jsonFile);

        return response.projects;
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  };
  return fetch;
}
