import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";

import computeSyncConfig from "../utils/computeSyncConfig";

export default function useSyncListingData() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();
  const {value: listing} = useSelectedListing();

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();

  // const

  const listings = listing ? [listing] : [];
  const syncScope = {
    ENTITIES: {direction: "BOTH", listings},
    FILES: {direction: "BOTH", listings, fileTypes: ["IMAGE"]},
  };

  const syncConfig = computeSyncConfig(syncScope);

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
      syncConfig,
      dispatch,
      //debug: true,
    };

    await syncService(options);
  };
  return syncData;
}
