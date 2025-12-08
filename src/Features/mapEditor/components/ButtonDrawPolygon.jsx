import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { IconButton, Tooltip } from "@mui/material";
import PolygonIcon from "Features/polygons/components/PolygonIcon";

export default function ButtonDrawPolygon() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "POLYGON" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <Tooltip title="Polygone">
      <IconButton size="small" onClick={handleClick} color="inherit"
        sx={{ borderRadius: "8px", border: theme => `1px solid ${theme.palette.divider}` }}
      >
        <PolygonIcon {...newAnnotation} />
      </IconButton>
    </Tooltip>
  );
}
