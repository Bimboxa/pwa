import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { IconButton, Tooltip } from "@mui/material";
import ShowChart from "@mui/icons-material/ShowChart";

// Starts the ADD_PROFILE_LINE drawing mode for the selected POLYGON. The
// InteractionLayer ADD_PROFILE_LINE branch commits the drawn polyline onto
// the currently selected annotation (selectedItem.nodeId), so no newAnnotation
// draft is needed here. The profile's vertical projection is then edited in
// the Élévation panel.
export default function IconButtonAddProfileLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const isActive = enabledDrawingMode === "ADD_PROFILE_LINE";

  // handlers

  function handleClick() {
    dispatch(setEnabledDrawingMode(isActive ? null : "ADD_PROFILE_LINE"));
  }

  return (
    <Tooltip title="Ajouter un profil">
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          color: isActive ? accentColor : "text.disabled",
          bgcolor: isActive ? accentColor + "18" : "transparent",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <ShowChart fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
