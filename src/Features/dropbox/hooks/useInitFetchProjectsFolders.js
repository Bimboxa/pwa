import {useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import {fetchProjectsFolders} from "../dropboxSlice";

import appConfigAsync from "App/appConfigAsync";

export default function useInitFetchProjectsFolders() {
  const dispatch = useDispatch();

  // data

  const data = useSelector((s) => s.servicesCredentials.data);
  const token = data?.dropbox?.accessToken;

  // helpers

  const fetchAsync = async () => {
    try {
      const appConfig = await appConfigAsync;
      const container = appConfig.remoteProjectsContainers.find(
        (c) => c.service === "DROPBOX"
      );
      const path = container.path;
      console.log("path", path, appConfig);

      if (path) {
        dispatch(fetchProjectsFolders({path, token}));
      }
    } catch (err) {
      console.log("error", err);
    }
  };

  useEffect(() => {
    if (token) fetchAsync();
  }, [token]);
}
