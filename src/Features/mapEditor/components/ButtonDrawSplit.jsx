import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

import CallSplit from "@mui/icons-material/CallSplit";

import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

export default function ButtonDrawSplit({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedAnnotation = useSelectedAnnotation();

  // helper

  const canSplit = selectedAnnotation && ["POLYGON", "POLYLINE", "STRIP"].includes(selectedAnnotation.type);

  // handler

  function handleClick() {
    if (!canSplit) return;
    dispatch(setNewAnnotation({
      ...newAnnotation,
      type: "SPLIT",
      splitHostId: selectedAnnotation.id,
    }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Diviser" size={32} onClick={handleClick} showBorder={true} disabled={disabled || !canSplit}>
      <CallSplit />
    </IconButtonToolbarGeneric>
  );
}
