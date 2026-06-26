import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { IconButton, Tooltip } from "@mui/material";
import Timeline from "@mui/icons-material/Timeline";

// Starts the ADD_GUIDE_LINE drawing mode for the selected POLYGON. The
// InteractionLayer ADD_GUIDE_LINE branch commits the drawn polyline onto the
// currently selected annotation (selectedItem.nodeId), so no newAnnotation
// draft is needed here.
export default function IconButtonAddGuideLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const isActive = enabledDrawingMode === "ADD_GUIDE_LINE";

  // handlers

  function handleClick() {
    dispatch(setEnabledDrawingMode(isActive ? null : "ADD_GUIDE_LINE"));
  }

  return (
    <Tooltip title="Ajouter une ligne guide">
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
        <Timeline fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
