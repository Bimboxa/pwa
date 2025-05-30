import {useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useRemoteProvider from "./useRemoteProvider";

import syncService from "../services/syncService";

import computeSyncConfig from "../utils/computeSyncConfig";

export default function useSyncListingData() {
  const dispatch = useDispatch();

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: listing} = useSelectedListing();

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // const

  const listings = listing ? [listing] : [];
  const syncScope = {
    ENTITIES: {
      direction: "BOTH",
      listings: listings?.filter((l) => l.type !== "ZONING"),
    },
    ZONINGS: {
      direction: "BOTH",
      listings: listings?.filter((l) => l.type === "ZONING"),
    },
    FILES: {direction: "BOTH", listings, fileTypes: ["IMAGE"]},
  };

  const syncConfig = computeSyncConfig(syncScope);

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
      syncConfig,
      dispatch,
      //debug: true,
    };

    await syncService(options);
  };
  return syncData;
}
