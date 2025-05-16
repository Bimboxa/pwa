import {useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import syncService from "../services/syncService";

import RemoteProvider from "../js/RemoteProvider";

import computeSyncConfig from "../utils/computeSyncConfig";
import useSyncFilesToPush from "./useSyncFilesToPush";
import computeSyncScopeFromSyncFiles from "../services/computeSyncScopeFromSyncFiles";

export default function useUploadChanges() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();

  const syncFiles = useSyncFilesToPush();
  const remoteContainer = useRemoteContainer();

  // handlers

  const syncData = async () => {
    // remoteProvider
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    // context
    const context = {
      remoteContainer,
      project: scope.project,
      scope,
    };

    // options
    const options = {
      context,
      remoteProvider,
      syncFiles,
      dispatch,
      //debug: true,
    };

    await syncService(options);
  };
  return syncData;
}
