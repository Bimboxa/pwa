import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import ContentCut from "@mui/icons-material/ContentCut";

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
    <IconButtonToolbarGeneric label="Couper" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <ContentCut />
    </IconButtonToolbarGeneric>
  );
}
