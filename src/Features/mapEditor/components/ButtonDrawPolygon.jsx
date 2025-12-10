import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import PolygonIcon from "Features/polygons/components/PolygonIcon";
import IconButtonToolbarGeneric from "Features/layout/components/IconButtonToolbarGeneric";

export default function ButtonDrawPolygon({ disabled }) {
  const dispatch = useDispatch();

  // data

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // helpers

  let override = {};
  if (disabled) override = { fillColor: "grey.300", strokeColor: "grey.300" }

  const annotation = { ...newAnnotation, ...override };

  // handler

  function handleClick() {
    dispatch(setNewAnnotation({ ...newAnnotation, type: "POLYGON" }))
    dispatch(setEnabledDrawingMode("CLICK"))
  }

  return (
    <IconButtonToolbarGeneric label="Polygone" size={32} onClick={handleClick} showBorder={true} disabled={disabled}>
      <PolygonIcon {...annotation} />
    </IconButtonToolbarGeneric>

  );
}
