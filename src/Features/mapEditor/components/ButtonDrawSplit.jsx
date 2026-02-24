import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";
import { ContentCut } from "@mui/icons-material";

export default function ButtonDrawSplit({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({
      ...newAnnotation,
      type: "SPLIT",
    }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Diviser" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <ContentCut />
    </IconButtonToolbarGeneric>
  );
}
