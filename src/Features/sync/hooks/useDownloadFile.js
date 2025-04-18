import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";

import RemoteProvider from "../js/RemoteProvider";

export default function useDownloadFile() {
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();

  const download = async (path) => {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });
    return await remoteProvider.downloadFile(path);
  };

  return download;
}
