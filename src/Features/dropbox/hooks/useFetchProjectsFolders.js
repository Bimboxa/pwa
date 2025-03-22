import {useDispatch} from "react-redux";

import {fetchProjectsFolders} from "../dropboxSlice";

import appConfigAsync from "App/appConfigAsync";
import useAccessTokenDropbox from "./useAccessTokenDropbox";

export default function useFetchProjectsFolders() {
  const dispatch = useDispatch();

  // data

  const token = useAccessTokenDropbox();

  // helpers

  const fetchAsync = async () => {
    try {
      const appConfig = await appConfigAsync;
      const container = appConfig.remoteProjectsContainers.find(
        (c) => c.service === "DROPBOX"
      );
      const path = container.path;

      if (path) {
        dispatch(fetchProjectsFolders({path, token}));
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
