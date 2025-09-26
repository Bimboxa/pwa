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
import useSelectedAnnotationTemplateInMapEditor from "../hooks/useSelectedAnnotationTemplateInMapEditor";

export default function ButtonDrawMarker() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const annotationTemplate = useSelectedAnnotationTemplateInMapEditor();

  // handler

  function handleClick() {
    // process annotation templates
    let _newAnnotation = { ...newAnnotation, type: "MARKER" };

    if (annotationTemplate) {
      _newAnnotation = { ..._newAnnotation, ...annotationTemplate };
    }

    //
    dispatch(setShowLayerScreenCursor(true));
    editor?.mapEditor?.enableDrawingMode("MARKER", { updateRedux: true });
    dispatch(setEnabledDrawingMode("MARKER"));

    dispatch(setNewAnnotation(_newAnnotation));
    dispatch(setSelectedAnnotationId(null));
    dispatch(setMainBaseMapIsSelected(false));

    if (!annotationTemplateId) dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Marker />
    </IconButton>
  );
}
