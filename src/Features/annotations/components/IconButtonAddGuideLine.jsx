import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import Timeline from "@mui/icons-material/Timeline";

import ToolbarToolButton from "./ToolbarToolButton";

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
    <ToolbarToolButton
      icon={<Timeline fontSize="small" />}
      label="Ajouter une ligne guide"
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
