import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import createDropboxFileService from "Features/dropbox/services/createDropboxFileService";

export default function useCreateRemoteFile() {
  const remoteContainer = useRemoteContainer();
  const {value: remoteToken} = useRemoteToken();

  const createFile = async ({path, blob}) => {
    if (!remoteContainer) {
      throw new Error("No remote container available");
    }

    const {service} = remoteContainer;

    switch (service) {
      case "DROPBOX":
        return createDropboxFileService({
          accessToken: remoteToken,
          path,
          blob,
        });
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  };

  return createFile;
}
