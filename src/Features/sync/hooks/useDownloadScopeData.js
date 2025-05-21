import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";
import useRemoteProvider from "./useRemoteProvider";

import syncConfig from "../syncConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import computeSyncConfig from "../utils/computeSyncConfig";

export default function useDownloadScopeData() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const listings = scope.sortedListings;

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // const

  const syncScope = {
    LISTINGS: {direction: "PULL", listings},
    ENTITIES: {direction: "PULL", listings},
    FILES: {direction: "PULL", listings, fileTypes: ["IMAGE"]},
  };

  // handlers

  const downloadData = async () => {
    // context
    const context = {
      remoteContainer,
      project: scope.project,
      scope,
      listings,
    };
    const syncConfig = computeSyncConfig(syncScope);
    console.log("sync config", syncConfig);
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
