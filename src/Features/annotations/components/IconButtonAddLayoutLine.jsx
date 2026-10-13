import { useDispatch, useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

import ViewWeek from "@mui/icons-material/ViewWeek";

import ToolbarToolButton from "./ToolbarToolButton";

// Starts the ADD_LAYOUT_LINE drawing mode for the selected POLYGON. The
// InteractionLayer ADD_LAYOUT_LINE branch commits the drawn polyline onto the
// currently selected annotation (selectedItem.nodeId) as a layoutLine
// ("ligne de calepinage"), so no newAnnotation draft is needed here.
//
// Shown only when the annotation's template has the Calepinage feature on
// (template.hasLayoutLines) — the template is read from useSelectedAnnotation
// (the overlay menu passes a resolved annotation without it).
export default function IconButtonAddLayoutLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const isActive = enabledDrawingMode === "ADD_LAYOUT_LINE";
  const selectedAnnotation = useSelectedAnnotation();
  const hasLayoutLines = Boolean(
    selectedAnnotation?.annotationTemplate?.hasLayoutLines
  );

  // handlers

  function handleClick() {
    dispatch(setEnabledDrawingMode(isActive ? null : "ADD_LAYOUT_LINE"));
  }

  if (!hasLayoutLines) return null;

  return (
    <ToolbarToolButton
      icon={<ViewWeek fontSize="small" />}
      label="Ajouter une ligne de calepinage"
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
