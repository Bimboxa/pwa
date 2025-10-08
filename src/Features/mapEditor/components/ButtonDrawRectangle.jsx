import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
  setShowLayerScreenCursor,
} from "../mapEditorSlice";

import {
  setNewAnnotation,
  setSelectedAnnotationId,
} from "Features/annotations/annotationsSlice";

import { Rectangle } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";

export default function ButtonDrawRectangle() {
  const dispatch = useDispatch();

  // strings

  const title = "Dessiner un rectangle";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    console.log("Rectangle button clicked!");

    // process annotation templates
    let _newAnnotation = { ...newAnnotation, type: "RECTANGLE" };

    dispatch(setShowLayerScreenCursor(true));
    dispatch(setEnabledDrawingMode("RECTANGLE"));

    dispatch(setNewAnnotation(_newAnnotation));
    dispatch(setSelectedAnnotationId(null));
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <Rectangle />
      </IconButton>
    </Tooltip>
  );
}
