import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Label } from "@mui/icons-material"
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

export default function ButtonDrawLabel({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // helpers

  let override = {};
  if (disabled) override = { fillColor: "grey.300", strokeColor: "grey.300" }

  const annotation = { ...newAnnotation, ...override };

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "LABEL" }))
    dispatch(setEnabledDrawingMode("ONE_CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Etiquette" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <Label sx={{ color: annotation.fillColor || annotation.strokeColor }} />
    </IconButtonToolbarGeneric>

  );
}
