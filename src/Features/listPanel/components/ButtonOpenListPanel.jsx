import {useDispatch, useSelector} from "react-redux";

import {setOpen} from "../listPanelSlice";

import {IconButton, Tooltip} from "@mui/material";
import {ViewList as Open} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";

import theme from "Styles/theme";

export default function ButtonOpenListPanel() {
  const dispatch = useDispatch();

  // string

  const title = "Ouvrir le panneau liste";

  // data

  const open = useSelector((s) => s.listPanel.open);

  // handlers

  function handleClick() {
    dispatch(setOpen(true));
  }
  return (
    <BoxCenter
      sx={{
        display: open ? "none" : "flex",
        bgcolor: theme.palette.button.dark,
        color: "white",
      }}
    >
      <Tooltip title={title}>
        <IconButton onClick={handleClick} color="inherit">
          <Open />
        </IconButton>
      </Tooltip>
    </BoxCenter>
  );
}
