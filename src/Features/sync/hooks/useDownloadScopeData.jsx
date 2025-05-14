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

  const fileList = [
    //{key: "project", direction: "PULL"},
    //{key: "scope", direction: "PULL"},
    {key: "listings", direction: "PULL"},
    {key: "entities", direction: "PULL"},
    {key: "images", direction: "PULL"},
  ];

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
      syncConfig: overrideSyncConfig(syncConfig, fileList),
      syncFilesByPath: {}, // to force the download of all files
      dispatch,
      //debug: true,
    };

    await syncService(options);
  };
  return downloadData;
}
