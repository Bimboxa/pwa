import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";
import useRemoteProvider from "./useRemoteProvider";

import computeSyncConfig from "../utils/computeSyncConfig";

export default function useUpdateScopeData() {
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
    SCOPE: {direction: "BOTH", listings},
    LISTINGS: {direction: "BOTH", listings},
    ENTITIES: {
      direction: "BOTH",
      listings: listings?.filter((l) => l.type !== "ZONING"),
    },
    MARKERS: {
      direction: "BOTH",
      listings: listings?.filter((l) => l.enableMarkers),
    },
    ZONINGS: {
      direction: "BOTH",
      listings: listings?.filter((l) => l.type === "ZONING"),
    },
    FILES: {direction: "BOTH", listings, fileTypes: ["IMAGE"]},
  };

  // handlers

  const updateData = async () => {
    // context
    const context = {
      remoteContainer,
      project: scope.project,
      scope,
      listings,
    };
    const syncConfig = computeSyncConfig(syncScope);
    // options
    const options = {
      context,
      remoteProvider,
      syncConfig,
      dispatch,
      debug: true,
    };

    await syncService(options);
  };
  return updateData;
}
