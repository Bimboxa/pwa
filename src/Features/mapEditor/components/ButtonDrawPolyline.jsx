import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { IconButton, Tooltip } from "@mui/material";
import PolylineIcon from "Features/polylines/components/PolylineIcon";

import theme from "Styles/theme";

export default function ButtonDrawPolyline() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "POLYLINE" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <Tooltip title="Polyligne">
      <IconButton size="small" onClick={handleClick} color="inherit"
        sx={{ borderRadius: "8px", border: theme => `1px solid ${theme.palette.divider}` }}
      >
        <PolylineIcon {...newAnnotation} />
      </IconButton>
    </Tooltip>
  );
}
