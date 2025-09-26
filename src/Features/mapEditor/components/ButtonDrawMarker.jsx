import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
  setMainBaseMapIsSelected,
  setShowLayerScreenCursor,
} from "../mapEditorSlice";
import {
  setNewAnnotation,
  setSelectedAnnotationId,
} from "Features/annotations/annotationsSlice";

import { AddCircle as Marker } from "@mui/icons-material";
import { IconButton } from "@mui/material";

import editor from "App/editor";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";

export default function ButtonDrawMarker() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  // handler

  function handleClick() {
    // process annotation templates
    let _newAnnotation = { ...newAnnotation, type: "MARKER" };

    if (annotationTemplateId) {
      const props = getPropsFromAnnotationTemplateId(annotationTemplateId);
      _newAnnotation = { ..._newAnnotation, ...props };
    }

    //
    dispatch(setShowLayerScreenCursor(true));
    editor?.mapEditor?.enableDrawingMode("MARKER", { updateRedux: true });
    dispatch(setEnabledDrawingMode("MARKER"));
    dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
    dispatch(setNewAnnotation(_newAnnotation));
    dispatch(setSelectedAnnotationId(null));
    dispatch(setMainBaseMapIsSelected(false));
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Marker />
    </IconButton>
  );
}
