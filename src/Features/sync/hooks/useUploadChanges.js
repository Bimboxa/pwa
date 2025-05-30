import {useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteContainer from "../hooks/useRemoteContainer";

import syncService from "../services/syncService";

import useSyncFilesToPush from "./useSyncFilesToPush";
import useRemoteProvider from "./useRemoteProvider";

export default function useUploadChanges() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});

  const syncFiles = useSyncFilesToPush();
  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // handlers

  const syncData = async () => {
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

    console.log("[uploadChanges] syncFiles", syncFiles);

    await syncService(options);
  };
  return syncData;
}
