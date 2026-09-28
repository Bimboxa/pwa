import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import SsidChart from "@mui/icons-material/SsidChart";

import ToolbarToolButton from "./ToolbarToolButton";

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
    <ToolbarToolButton
      icon={<SsidChart fontSize="small" />}
      label="Ajouter une courbe de niveau"
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
