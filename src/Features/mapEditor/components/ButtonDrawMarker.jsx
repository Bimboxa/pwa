import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
} from "../mapEditorSlice";
import {
  setNewAnnotation,
} from "Features/annotations/annotationsSlice";

import { AddLocationAlt as Marker } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";

// import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

export default function ButtonDrawMarker() {
  const dispatch = useDispatch();

  // strings

  const title = "Ajouter un repère";

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  //const spriteImage = useAnnotationSpriteImage();

  // helper

  // const annotationProps = { ...newAnnotation, spriteImage, iconKey: "info", type: "MARKER" }

  // handler

  function handleClick() {
    // process annotation templates
    let _newAnnotation = { ...newAnnotation, iconKey: "circle", type: "MARKER" };
    dispatch(setNewAnnotation(_newAnnotation));
    dispatch(setEnabledDrawingMode("ONE_CLICK"));
  }

  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={handleClick} color="inherit"
        sx={{ borderRadius: "8px", border: theme => `1px solid ${theme.palette.divider}` }}
      >
        <Marker sx={{ color: newAnnotation?.fillColor }} />
      </IconButton>
    </Tooltip>
  );
}
