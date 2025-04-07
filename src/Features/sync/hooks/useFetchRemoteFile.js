import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import fetchFileDropboxService from "Features/dropbox/services/fetchFileService";

export default function useFetchRemoteFile() {
  const remoteContainer = useRemoteContainer();
  const {value: remoteToken} = useRemoteToken();

  const fetchFile = async (filePath) => {
    if (!remoteContainer) {
      throw new Error("No remote container available");
    }

    const {service} = remoteContainer;

    switch (service) {
      case "DROPBOX":
        return fetchFileDropboxService({
          accessToken: remoteToken,
          path: filePath,
        });
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  };

  return fetchFile;
}
