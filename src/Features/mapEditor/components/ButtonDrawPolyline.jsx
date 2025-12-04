import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { IconButton } from "@mui/material";
import PolylineIcon from "Features/polylines/components/PolylineIcon";

import theme from "Styles/theme";

export default function ButtonDrawPolyline() {
  const dispatch = useDispatch();

  // state

  const [annotationProps, setAnnotationProps] = useState({
    type: "POLYLINE",
    strokeColor: theme.palette.secondary.main,
    strokeWidth: 1,
    strokeWidthUnit: "PX",
  })

  // handler

  function handleClick() {
    dispatch(setNewAnnotation(annotationProps))
    dispatch(setEnabledDrawingMode("POLYLINE"))
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <PolylineIcon {...annotationProps} />
    </IconButton>
  );
}
