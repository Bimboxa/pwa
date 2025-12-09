import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";
import PolylineIcon from "Features/polylines/components/PolylineIcon";

export default function ButtonDrawPolyline() {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "POLYLINE" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Polyligne" size={32} onClick={handleClick} showBorder={true}>
      <PolylineIcon {...newAnnotation} />
    </IconButtonToolbarGeneric>
  );
}
