import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useIsSignedIn from "Features/auth/hooks/useIsSignedIn";
import useSyncFilesToPush from "../hooks/useSyncFilesToPush";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useSaveShortcut from "Features/layout/hooks/useSaveShortcut";

import {Box, IconButton, Tooltip, Badge} from "@mui/material";

import BlockSyncIndicator from "./BlockSyncIndicator";

import useUploadChanges from "../hooks/useUploadChanges";

export default function ButtonMenuSyncIndicator() {
  const dispatch = useDispatch();

  // strings

  const dialogTitle = "Sync";

  // data

  const isSignedIn = useIsSignedIn();
  const open = useSelector((s) => s.sync.openPanelSync);
  const remoteContainer = useRemoteContainer();
  const syncFilesToPush = useSyncFilesToPush();

  // data - func

  const uploadSyncFiles = useUploadChanges();

  // state

  const [syncing, setSyncing] = useState(false);

  // data - saveShortcut (CTRL+S)

  const onSave = async () => {
    console.log("save");
    setSyncing(true);
    await uploadSyncFiles();
    setSyncing(false);
  };
  useSaveShortcut(onSave);

  // helpers - color

  const color = "action.main";

  // helpers

  const title = remoteContainer?.name ?? "Sync off";
  const syncCounter = syncFilesToPush?.length;

  // handlers

  const handleClick = async () => {
    dispatch(setOpenPanelSync(true));
    await onSave();
    dispatch(setOpenPanelSync(false));
  };

  return (
    <Tooltip title={title}>
      <Box
        sx={{display: "flex", alignItems: "center", justifyContent: "center"}}
      >
        <Badge
          badgeContent={syncCounter}
          color="warning"
          variant={syncing ? "dot" : "standard"}
        >
          <IconButton
            onClick={handleClick}
            disabled={!isSignedIn}
            size="small"
            loading={syncing}
          >
            <BlockSyncIndicator color={color} />
          </IconButton>
        </Badge>
      </Box>
    </Tooltip>
  );
}
