import { useDispatch, useSelector } from "react-redux";

import { setPanelOpen } from "../planningSlice";

import { IconButton, Tooltip } from "@mui/material";
import { ViewTimeline } from "@mui/icons-material";

// Opens / closes the bottom time-planning panel (PLANNING module).
export default function ButtonTogglePlanningPanel() {
  const dispatch = useDispatch();
  const panelOpen = useSelector((s) => s.planning.panelOpen);

  return (
    <Tooltip title={panelOpen ? "Fermer le planning" : "Planning temporel"}>
      <IconButton
        size="small"
        color={panelOpen ? "primary" : "default"}
        onClick={() => dispatch(setPanelOpen(!panelOpen))}
      >
        <ViewTimeline sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}
