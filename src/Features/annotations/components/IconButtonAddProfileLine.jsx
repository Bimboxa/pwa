import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import ShowChart from "@mui/icons-material/ShowChart";

import ToolbarToolButton from "./ToolbarToolButton";

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
    <ToolbarToolButton
      icon={<ShowChart fontSize="small" />}
      label="Ajouter un profil"
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
