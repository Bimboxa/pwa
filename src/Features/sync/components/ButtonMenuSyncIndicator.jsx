import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useIsSignedIn from "Features/auth/hooks/useIsSignedIn";
import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import {Box, IconButton, Tooltip} from "@mui/material";

import BlockSyncIndicator from "./BlockSyncIndicator";
import PanelSync from "./PanelSync";

import getRemoteProjectContainerGenericProps from "../utils/getRemoteProjectContainerGenericProps";
import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";

export default function ButtonMenuSyncIndicator() {
  const dispatch = useDispatch();

  // strings

  const dialogTitle = "Sync";

  // data

  const isSignedIn = useIsSignedIn();
  const open = useSelector((s) => s.sync.openPanelSync);
  const {value: props} = useRemoteProjectContainerProps();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers - color

  const color = props?.type ? "success.main" : "action.main";

  // helpers

  const {name, serviceName} = getRemoteProjectContainerGenericProps(props);
  let title = `[${serviceName}] ${name}`;
  if (!props) title = "Sync off";

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
          <IconButton onClick={handleClick} disabled={!isSignedIn}>
            <BlockSyncIndicator color={color} />
          </IconButton>
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
