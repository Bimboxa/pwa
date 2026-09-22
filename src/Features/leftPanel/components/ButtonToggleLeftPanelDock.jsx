import { useDispatch, useSelector } from "react-redux";

import { setLeftPanelDocked, setLeftDrawerHovered } from "../leftPanelSlice";

import useLeftAreaHover from "../hooks/useLeftAreaHover";

import { IconButton, Tooltip } from "@mui/material";
import { ViewSidebar } from "@mui/icons-material";

// Toggle that docks / undocks the left module drawer. Rendered in front of
// the title of every left drawer header (LeftDrawerPanelHeader).
export default function ButtonToggleLeftPanelDock({
  size = "small",
  iconFontSize = 20,
  sx,
}) {
  const dispatch = useDispatch();

  // strings

  const dockS = "Garder le panneau latéral ouvert";
  const undockS = "Masquer le panneau latéral";

  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  // hover - reveal the left drawer overlay when undocked

  const { onMouseEnter, onMouseLeave } = useLeftAreaHover();

  // handlers

  function handleToggle() {
    const nextDocked = !leftPanelDocked;
    dispatch(setLeftPanelDocked(nextDocked));
    // Undocking from inside the drawer: LeftDrawerPanel attaches its hover
    // handlers only in overlay mode, so leftDrawerHovered may be false at
    // this point. Force it so the overlay stays while the mouse is over it;
    // the drawer's onMouseLeave closes it afterwards.
    if (!nextDocked) dispatch(setLeftDrawerHovered(true));
  }

  // render

  return (
    <Tooltip title={leftPanelDocked ? undockS : dockS}>
      <IconButton
        size={size}
        onClick={handleToggle}
        onMouseEnter={leftPanelDocked ? undefined : onMouseEnter}
        onMouseLeave={leftPanelDocked ? undefined : onMouseLeave}
        sx={{
          color: "action.active",
          bgcolor: leftPanelDocked ? "action.selected" : "transparent",
          borderRadius: 1,
          p: 0.5,
          ...sx,
        }}
      >
        <ViewSidebar sx={{ fontSize: iconFontSize }} />
      </IconButton>
    </Tooltip>
  );
}
