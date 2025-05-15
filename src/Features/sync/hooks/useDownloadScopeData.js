import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";

import syncConfig from "../syncConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import computeSyncConfig from "../utils/computeSyncConfig";

export default function useDownloadScopeData() {
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
    LISTINGS: {direction: "PULL", listings},
    ENTITIES: {direction: "PULL", listings},
    FILES: {direction: "PULL", listings, fileTypes: ["IMAGE"]},
  };

  const syncConfig = computeSyncConfig(syncScope);

  // handlers

  const downloadData = async () => {
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
      listings,
    };

    console.log("sync context", context);
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
  return downloadData;
}
