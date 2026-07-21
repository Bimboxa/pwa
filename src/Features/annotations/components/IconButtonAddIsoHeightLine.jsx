import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { IconButton, Tooltip } from "@mui/material";
import SsidChart from "@mui/icons-material/SsidChart";

// Starts the ADD_ISO_HEIGHT_LINE drawing mode for the selected POLYGON. The
// InteractionLayer ADD_ISO_HEIGHT_LINE branch commits the drawn polyline onto
// the currently selected annotation (selectedItem.nodeId), so no newAnnotation
// draft is needed here.
export default function IconButtonAddIsoHeightLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const isActive = enabledDrawingMode === "ADD_ISO_HEIGHT_LINE";

  // handlers

  function handleClick() {
    dispatch(setEnabledDrawingMode(isActive ? null : "ADD_ISO_HEIGHT_LINE"));
  }

  return (
    <Tooltip title="Ajouter une courbe de niveau">
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
        <SsidChart fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
