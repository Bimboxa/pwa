import { useDispatch, useSelector } from "react-redux";

import { setLeftPanelDocked } from "../leftPanelSlice";

import { IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ViewSidebar } from "@mui/icons-material";

// Top bar toggle of the left module dock. Two states: hidden (default) and
// pinned open in flow. One icon for both — the pinned state reads in the
// button style (secondary tint + border), the tooltip says a click unpins.
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

  return (
    <Tooltip title={leftPanelDocked ? hideS : showS}>
      <IconButton
        size={size}
        onClick={handleToggle}
        sx={(theme) => ({
          borderRadius: 1,
          p: 0.5,
          // The border is always there, transparent when unpinned, so the
          // toggle never shifts the breadcrumbs.
          border: "1px solid",
          ...(leftPanelDocked
            ? {
                color: "secondary.main",
                borderColor: "secondary.main",
                bgcolor: alpha(theme.palette.secondary.main, 0.12),
                "&:hover": {
                  bgcolor: alpha(theme.palette.secondary.main, 0.2),
                },
              }
            : {
                color: "action.active",
                borderColor: "transparent",
                bgcolor: "transparent",
              }),
          ...sx,
        })}
      >
        <ViewSidebar sx={{ fontSize: iconFontSize }} />
      </IconButton>
    </Tooltip>
  );
}
