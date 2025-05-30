import {useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import syncService from "../services/syncService";

import RemoteProvider from "../js/RemoteProvider";

import db from "App/db/db";
import computeSyncConfig from "../utils/computeSyncConfig";

export default function useUploadScopeData() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();
  const {value: listings} = useListingsByScope();

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();

  // const

  const syncScope = {
    PROJECT: {direction: "PUSH", project: scope?.project},
    SCOPE: {direction: "PUSH", scope},
    LISTINGS: {direction: "PUSH", listings},
    ENTITIES: {
      direction: "PUSH",
      listings: listings?.filter((l) => l.type !== "ZONING"),
    },
    ZONINGS: {
      direction: "PUSH",
      listings: listings?.filter((l) => l.type === "ZONING"),
    },
    FILES: {direction: "PUSH", listings, fileTypes: ["IMAGE"]},
  };

  const syncConfig = computeSyncConfig(syncScope);

  // handlers

  const uploadData = async () => {
    // reset syncFiles
    await db.syncFiles.clear();

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
      //listings,
    };

    // options
    const options = {
      context,
      remoteProvider,
      syncConfig,
      //syncConfig: overrideSyncConfig(syncConfig, fileList),
      dispatch,
      //debug: true,
    };

    await syncService(options);
  };

  // return

  return uploadData;
}
