import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
  setMainBaseMapIsSelected,
  setShowLayerScreenCursor,
  clearDrawingPolylinePoints,
} from "../mapEditorSlice";
import {
  setNewAnnotation,
  setSelectedAnnotationId,
} from "Features/annotations/annotationsSlice";

import { Polyline } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";

import editor from "App/editor";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";
import useSelectedAnnotationTemplateInMapEditor from "../hooks/useSelectedAnnotationTemplateInMapEditor";

export default function ButtonDrawPolylineV2() {
  const dispatch = useDispatch();

  // strings

  const title = "Dessiner une ligne ou un polygone";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const annotationTemplate = useSelectedAnnotationTemplateInMapEditor();

  // handler

  function handleClick() {
    console.log("Polyline button clicked!");

    // Clear any existing polyline points
    dispatch(clearDrawingPolylinePoints());

    // process annotation templates
    let _newAnnotation = { ...newAnnotation, type: "POLYLINE" };

    if (annotationTemplate) {
      _newAnnotation = { ..._newAnnotation, ...annotationTemplate };
    }

    //
    dispatch(setShowLayerScreenCursor(true));

    dispatch(setEnabledDrawingMode("POLYLINE"));

    dispatch(setNewAnnotation(_newAnnotation));
    dispatch(setSelectedAnnotationId(null));
    dispatch(setMainBaseMapIsSelected(false));

    if (!annotationTemplateId) dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <Polyline />
      </IconButton>
    </Tooltip>
  );
}
