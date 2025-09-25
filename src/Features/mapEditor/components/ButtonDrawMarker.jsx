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

export default function ButtonDrawMarker() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setShowLayerScreenCursor(true));
    editor?.mapEditor?.enableDrawingMode("MARKER", { updateRedux: true });
    dispatch(setEnabledDrawingMode("MARKER"));
    dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
    dispatch(setNewAnnotation({ ...newAnnotation, type: "MARKER" }));
    dispatch(setSelectedAnnotationId(null));
    dispatch(setMainBaseMapIsSelected(false));
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Marker />
    </IconButton>
  );
}
