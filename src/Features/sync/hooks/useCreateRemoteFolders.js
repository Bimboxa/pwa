import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import createFoldersDropboxService from "Features/dropbox/services/createFoldersDropboxService";

export default function useCreateRemoteFolders() {
  const remoteContainer = useRemoteContainer();
  const {value: remoteToken} = useRemoteToken();

  const createFolders = async (pathList) => {
    if (!remoteContainer) {
      throw new Error("No remote container available");
    }

    const {service} = remoteContainer;

    switch (service) {
      case "DROPBOX":
        return createFoldersDropboxService({
          accessToken: remoteToken,
          pathList,
        });
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  };

  return createFolders;
}
