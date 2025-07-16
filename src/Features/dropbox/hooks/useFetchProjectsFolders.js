//import {useDispatch} from "react-redux";

import useRemoteToken from "Features/sync/hooks/useRemoteToken";

export default function useFetchProjectsFolders() {
  //const dispatch = useDispatch();
  console.log("[ TO DELETE ]");
  // data

  const { value: token } = useRemoteToken();

  // helpers

  const fetchAsync = async () => {
    try {
      console.log("[ TO DELETE ]");
      // const appConfig = await appConfigAsync;
      // const container = appConfig.remoteProjectsContainers.find(
      //   (c) => c.service === "DROPBOX"
      // );
      // const path = container.path;

      // if (path) {
      //   dispatch(fetchProjectsFolders({path, token}));
      // }
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
