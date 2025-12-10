import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";
import PolylineIcon from "Features/polylines/components/PolylineIcon";

export default function ButtonDrawPolyline({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // helpers

  let override = {};
  if (disabled) override = { fillColor: "grey.300", strokeColor: "grey.300" }

  const annotation = { ...newAnnotation, ...override };

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "POLYLINE" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Polyligne" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <PolylineIcon {...annotation} />
    </IconButtonToolbarGeneric>
  );
}
