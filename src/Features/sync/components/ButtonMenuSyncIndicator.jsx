import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useIsSignedIn from "Features/auth/hooks/useIsSignedIn";

import {Box, IconButton, Tooltip, Badge} from "@mui/material";

import BlockSyncIndicator from "./BlockSyncIndicator";
import PanelSync from "./PanelSync";

import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";
import useSyncFilesToPush from "../hooks/useSyncFilesToPush";
import useRemoteContainer from "../hooks/useRemoteContainer";

export default function ButtonMenuSyncIndicator() {
  const dispatch = useDispatch();

  // strings

  const dialogTitle = "Sync";

  // data

  const isSignedIn = useIsSignedIn();
  const open = useSelector((s) => s.sync.openPanelSync);
  const remoteContainer = useRemoteContainer();

  const syncFilesToPush = useSyncFilesToPush();
  console.log("[debug] syncFilesToPush", syncFilesToPush);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers - color

  const color = "action.main";

  // helpers

  const title = remoteContainer?.name ?? "Sync off";
  const syncCounter = syncFilesToPush?.length;

  // handlers

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    dispatch(setOpenPanelSync(true));
  };

  const handleClose = () => {
    dispatch(setOpenPanelSync(false));
  };

  return (
    <>
      <Tooltip title={title}>
        <Box
          sx={{display: "flex", alignItems: "center", justifyContent: "center"}}
        >
          <Badge badgeContent={syncCounter} color="warning">
            <IconButton
              onClick={handleClick}
              disabled={!isSignedIn}
              size="small"
            >
              <BlockSyncIndicator color={color} />
            </IconButton>
          </Badge>
        </Box>
      </Tooltip>
      <DialogFsOrMenu
        title={dialogTitle}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        //onClick={() => setAnchorEl(null)}
      >
        <PanelSync />
      </DialogFsOrMenu>
    </>
  );
}
