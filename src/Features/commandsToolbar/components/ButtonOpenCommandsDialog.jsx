import { useDispatch, useSelector } from "react-redux";

import {
  selectCommandsDialogOpen,
  setCommandsDialogOpen,
} from "../commandsToolbarSlice";

import { IconButton, Tooltip } from "@mui/material";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

// Last button of the commands toolbar: opens the « Commandes » dialog
// (DialogCommands) — the list of every command with its helper, and the
// choice of the right-click shortcuts. Not a command of the registry (it
// must not be a shortcut itself) — same look as CommandButton in the
// toolbar row.
export default function ButtonOpenCommandsDialog() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Commandes : liste et raccourcis";

  // data

  const open = useSelector(selectCommandsDialogOpen);

  // render

  return (
    <Tooltip title={labelS} enterDelay={400}>
      <IconButton
        size="small"
        onClick={() => dispatch(setCommandsDialogOpen(true))}
        sx={{
          borderRadius: "8px",
          color: open ? "secondary.contrastText" : "secondary.main",
          bgcolor: open ? "secondary.main" : "transparent",
          "& .MuiSvgIcon-root": { fontSize: 18 },
          "&:hover": {
            color: open ? "secondary.contrastText" : "secondary.dark",
            bgcolor: open ? "secondary.dark" : "action.hover",
          },
        }}
      >
        <IconRightClickShortcut />
      </IconButton>
    </Tooltip>
  );
}
