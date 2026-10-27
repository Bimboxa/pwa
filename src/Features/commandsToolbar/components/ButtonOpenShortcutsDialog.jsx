import { useDispatch, useSelector } from "react-redux";

import {
  selectShortcutsDialogOpen,
  setShortcutsDialogOpen,
} from "../commandsToolbarSlice";

import { IconButton, Tooltip } from "@mui/material";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

// Last button of the commands toolbar: opens the « Raccourcis » dialog
// (DialogCommandShortcuts) choosing the commands of the right-click menu.
// Not a command of the registry (it must not be a shortcut itself) — same
// look as CommandButton in the toolbar row.
export default function ButtonOpenShortcutsDialog() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Raccourcis du clic droit";

  // data

  const open = useSelector(selectShortcutsDialogOpen);

  // render

  return (
    <Tooltip title={labelS} enterDelay={400}>
      <IconButton
        size="small"
        onClick={() => dispatch(setShortcutsDialogOpen(true))}
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
