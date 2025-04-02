import {useDispatch} from "react-redux";

import appConfigAsync from "App/appConfigAsync";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";

export default function useFetchRemoteProjectSyncData() {
  const dispatch = useDispatch();

  // data

  const token = useRemoteToken();

  // helpers

  const fetchAsync = async () => {
    try {
      const appConfig = await appConfigAsync;
      const container = appConfig.remoteProjectsContainers.find(
        (c) => c.service === "DROPBOX"
      );
      const path = container.path;

      if (path) {
        //dispatch(fetchRemoteProjectSyncData({path, token}));
      }
    } catch (err) {
      console.log("error", err);
    }
  };

  if (token) {
    return fetchAsync;
  } else {
    return null;
  }
}
