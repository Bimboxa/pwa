import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { StopCircle as CutIcon } from "@mui/icons-material";

import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

export default function ButtonDrawCut({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "CUT" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Ouverture" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <CutIcon />
    </IconButtonToolbarGeneric>
  );
}
