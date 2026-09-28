import { useDispatch, useSelector } from "react-redux";

import { setSubtractSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import ToolbarToolButton from "./ToolbarToolButton";
import IconSubtract from "./IconSubtract";

export default function IconButtonSubtractAnnotation({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();

  // data

  const subtractSourceAnnotationId = useSelector(
    (s) => s.mapEditor.subtractSourceAnnotationId
  );
  const isActive = subtractSourceAnnotationId === annotation?.id;

  // handlers

  function handleClick() {
    if (isActive) {
      dispatch(setSubtractSourceAnnotationId(null));
    } else {
      dispatch(setSubtractSourceAnnotationId(annotation.id));
      dispatch(clearSelection());
    }
  }

  return (
    <ToolbarToolButton
      icon={<IconSubtract fontSize="small" />}
      label={
        isActive ? "Annuler la soustraction" : "Soustraire une annotation"
      }
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
