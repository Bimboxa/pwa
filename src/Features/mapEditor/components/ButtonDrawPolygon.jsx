import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { IconButton } from "@mui/material";
import PolygonIcon from "Features/polygons/components/PolygonIcon";

import theme from "Styles/theme";

export default function ButtonDrawPolygon() {
  const dispatch = useDispatch();

  // state

  const [annotationProps, setAnnotationProps] = useState({
    type: "POLYGON",
    fillColor: theme.palette.secondary.main,
    fillType: "SOLID",
    fillOpacity: 0.8,
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
      <PolygonIcon {...annotationProps} />
    </IconButton>
  );
}
