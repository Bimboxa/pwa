import { useDispatch, useSelector } from "react-redux";

import { setSubtractTargetAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import ToolbarToolButton from "./ToolbarToolButton";
import IconSubtractFrom from "./IconSubtractFrom";

// Reverse of IconButtonSubtractAnnotation: instead of picking what is
// subtracted from this annotation, this arms a mode where each clicked
// annotation gets carved BY this one. Both write the same
// relAnnotationSubtractions row, only the direction of the pick differs.
export default function IconButtonSubtractFromAnnotation({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();

  // data

  const subtractTargetAnnotationId = useSelector(
    (s) => s.mapEditor.subtractTargetAnnotationId
  );
  const isActive = subtractTargetAnnotationId === annotation?.id;

  // handlers

  function handleClick() {
    if (isActive) {
      dispatch(setSubtractTargetAnnotationId(null));
    } else {
      dispatch(setSubtractTargetAnnotationId(annotation.id));
      dispatch(clearSelection());
    }
  }

  return (
    <ToolbarToolButton
      icon={<IconSubtractFrom fontSize="small" />}
      label={isActive ? "Annuler la soustraction" : "À soustraire de…"}
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
