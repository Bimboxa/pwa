import { useDispatch, useSelector } from "react-redux";

import {
  setEnabledDrawingMode,
} from "../mapEditorSlice";
import {
  setNewAnnotation,
} from "Features/annotations/annotationsSlice";

import { AddLocationAlt as Marker } from "@mui/icons-material";
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

// import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

export default function ButtonDrawMarker({ disabled }) {
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
    <IconButtonToolbarGeneric label={title} size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <Marker fontSize="small" sx={{ color: disabled ? "grey.300" : newAnnotation?.fillColor }} />
    </IconButtonToolbarGeneric>

  );
}
