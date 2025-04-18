import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useRemoteToken from "Features/sync/hooks/useRemoteToken";
import useRemoteContainer from "../hooks/useRemoteContainer";

import {IconButton} from "@mui/material";
import {Refresh} from "@mui/icons-material";

import SectionSyncTasks from "./SectionSyncTasks";
import DialogGeneric from "Features/layout/components/DialogGeneric";

import syncService from "../services/syncService";
import {overrideSyncConfig} from "../utils/overrideSyncConfig";

import RemoteProvider from "../js/RemoteProvider";

import syncConfig from "../syncConfig";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function IconButtonSyncScope() {
  const dispatch = useDispatch();
  // data

  const {value: scope} = useSelectedScope({withProject: true});
  const {value: accessToken} = useRemoteToken();
  const remoteContainer = useRemoteContainer();
  const syncFiles = useSelector((s) => s.sync.syncFiles);

  console.log("debug 42", syncFiles);

  // const

  const fileList = [
    {key: "project", direction: "BOTH"},
    {key: "scope", direction: "BOTH"},
    {key: "relsScopeItem", direction: "BOTH"},
    {key: "listings", direction: "BOTH"},

    //{key: "entities", direction: "BOTH"},
  ];

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleClick() {
    // syncFilesByPath
    const syncFilesByPath = getItemsByKey(syncFiles, "path");

    // remoteProvider
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    // options
    const options = {
      context: {remoteContainer, project: scope.project, scope},
      remoteProvider,
      syncConfig: overrideSyncConfig(syncConfig, fileList),
      syncFilesByPath,
      dispatch,
    };

    // main
    setLoading(true);
    await syncService(options);
    //setLoading(false);
  }
  return (
    <>
      <IconButton onClick={handleClick} loading={loading}>
        <Refresh />
      </IconButton>
      {loading && (
        <DialogGeneric open={loading} onClose={() => setLoading(false)}>
          <SectionSyncTasks />
        </DialogGeneric>
      )}
    </>
  );
}
