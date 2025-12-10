import { useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Straighten } from "@mui/icons-material";
import { IconButton, Box } from "@mui/material";
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";


import theme from "Styles/theme";

export default function ButtonEditScale() {
  const dispatch = useDispatch();


  // handler

  function handleClick() {
    dispatch(setEnabledDrawingMode("MEASURE"));
    dispatch(setNewAnnotation(
      {
        type: "POLYLINE",
        strokeColor: theme.palette.secondary.main,
        strokeWidth: 2,
        strokeWidthUnit: "PX",
      }
    ));
  }

  return (

    <IconButtonToolbarGeneric onClick={handleClick} size={32} label={"Prendre une cote"}>
      <Straighten fontSize="small" />
    </IconButtonToolbarGeneric>

  );
}
