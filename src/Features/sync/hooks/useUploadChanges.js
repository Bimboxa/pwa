import useSyncFilesToPush from "./useSyncFilesToPush";
import useRemoteToken from "./useRemoteToken";
import useRemoteContainer from "./useRemoteContainer";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import uploadSyncFile from "../services/uploadSyncFile";

import RemoteProvider from "../js/RemoteProvider";

export default function useUploadChanges() {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();
  const syncFilesToPush = useSyncFilesToPush();
  const {value: scope} = useSelectedScope({withProject: true});

  // main

  const upload = async () => {
    // context
    const context = {
      remoteContainer,
      project: scope.project,
      scope,
    };

    console.log("[useUploadChanges] syncFilesToPush", syncFilesToPush, context);
    // remoteProvider
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    for (const syncFile of syncFilesToPush) {
      await uploadSyncFile({remoteProvider, syncFile, context});
    }
  };

  return upload;
}
