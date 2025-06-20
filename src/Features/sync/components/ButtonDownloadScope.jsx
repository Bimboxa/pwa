import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import {Button} from "@mui/material";
import {Refresh} from "@mui/icons-material";

import SectionSyncTasks from "./SectionSyncTasks";
import DialogGeneric from "Features/layout/components/DialogGeneric";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";

import syncConfig from "../syncConfig";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useRemoteProvider from "../hooks/useRemoteProvider";

export default function ButtonDownloadScope() {
  const dispatch = useDispatch();

  // strings

  const downloadS = "Télécharger toutes les données";

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();
  const {value: listings} = useListingsByScope();

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();
  const remoteProvider = useRemoteProvider();

  // const

  const fileList = [
    {key: "project", direction: "PULL"},
    {key: "scope", direction: "PULL"},
    {key: "listings", direction: "PULL"},
    {key: "entities", direction: "PULL"},
    {key: "images", direction: "PULL"},
  ];

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleClick() {
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
    };

    // main
    setLoading(true);
    await syncService(options);
    setLoading(false);
  }
  return (
    <>
      <ButtonInPanel
        onClick={handleClick}
        loading={loading}
        label={downloadS}
      />

      {loading && (
        <DialogGeneric open={loading} onClose={() => setLoading(false)}>
          <SectionSyncTasks />
        </DialogGeneric>
      )}
    </>
  );
}
