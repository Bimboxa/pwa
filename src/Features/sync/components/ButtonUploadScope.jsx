import {useState} from "react";

import {useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import SectionSyncTasks from "./SectionSyncTasks";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";

import syncConfig from "../syncConfig";

import db from "App/db/db";

export default function ButtonUploadScope() {
  const dispatch = useDispatch();

  // strings

  const downloadS = "Sauvegarder toutes les données";

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();
  const {value: listings} = useListingsByScope();

  // TODO : add listings & relScopItem ? to the context
  // TODO : override syncFilesPath to add the items if they do not exists on dropbox.

  const remoteContainer = useRemoteContainer();

  // const

  const fileList = [
    {key: "project", direction: "PUSH"},
    {key: "scope", direction: "PUSH"},
    {key: "listings", direction: "PUSH"},
    {key: "entities", direction: "PUSH"},
  ];

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleClick() {
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
      listings,
    };

    // options
    const options = {
      context,
      remoteProvider,
      syncConfig: overrideSyncConfig(syncConfig, fileList),
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
