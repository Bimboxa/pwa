import { useDispatch, useSelector } from "react-redux";

import { setLeftPanelDocked } from "../leftPanelSlice";

import { IconButton, Tooltip } from "@mui/material";
import { ViewSidebar, PushPin } from "@mui/icons-material";

// Top bar toggle of the left module dock. Two states: hidden (default,
// ViewSidebar icon) and pinned open in flow (PushPin icon).
export default function ButtonToggleLeftPanelDock({
  size = "small",
  iconFontSize = 20,
  sx,
}) {
  const dispatch = useDispatch();

  // strings

  const showS = "Afficher le panneau latéral";
  const hideS = "Panneau latéral verrouillé – cliquer pour le masquer";

  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // handlers

  function handleToggle() {
    dispatch(setLeftPanelDocked(!leftPanelDocked));
  }

  // render

  const Icon = leftPanelDocked ? PushPin : ViewSidebar;

  return (
    <Tooltip title={leftPanelDocked ? hideS : showS}>
      <IconButton
        size={size}
        onClick={handleToggle}
        sx={{
          color: "action.active",
          bgcolor: leftPanelDocked ? "action.selected" : "transparent",
          borderRadius: 1,
          p: 0.5,
          ...sx,
        }}
      >
        <Icon sx={{ fontSize: iconFontSize }} />
      </IconButton>
    </Tooltip>
  );
}
