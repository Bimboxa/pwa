import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import {Menu, IconButton, Tooltip} from "@mui/material";

import BlockSyncIndicator from "./BlockSyncIndicator";
import PanelSync from "./PanelSync";

import getRemoteProjectContainerGenericProps from "../utils/getRemoteProjectContainerGenericProps";

export default function ButtonMenuSyncIndicator() {
  const dispatch = useDispatch();

  // data

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
        <IconButton onClick={handleClick}>
          <BlockSyncIndicator color={color} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        //onClick={() => setAnchorEl(null)}
      >
        <PanelSync />
      </Menu>
    </>
  );
}
