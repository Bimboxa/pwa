import { useDispatch } from "react-redux";

import {
  setEnabledDrawingMode,
  setShowLayerScreenCursor,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { TextFields as TextIcon } from "@mui/icons-material";
import { IconButton } from "@mui/material";

import editor from "App/editor";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

export default function ButtonAddText() {
  const dispatch = useDispatch();
  // handler

  function handleClick() {
    dispatch(setShowLayerScreenCursor(true));
    //editor?.mapEditor?.enableDrawingMode("MARKER", { updateRedux: true });
    dispatch(setEnabledDrawingMode("TEXT"));
    dispatch(setSelectedMenuItemKey("ANNOTATION_FORMAT"));
    dispatch(setNewAnnotation({ type: "TEXT" }));
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <TextIcon />
    </IconButton>
  );
}
