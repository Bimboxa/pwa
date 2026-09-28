import { useDispatch, useSelector } from "react-redux";

import { setAnchorSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import ToolbarToolButton from "./ToolbarToolButton";
import IconAnchorSnap from "./IconAnchorSnap";

export default function IconButtonAnchorAnnotation({ annotation, accentColor }) {
  const dispatch = useDispatch();

  // data

  const anchorSourceAnnotationId = useSelector(
    (s) => s.mapEditor.anchorSourceAnnotationId
  );
  const isActive = anchorSourceAnnotationId === annotation?.id;

  // handlers

  function handleClick() {
    if (isActive) {
      dispatch(setAnchorSourceAnnotationId(null));
    } else {
      dispatch(setAnchorSourceAnnotationId(annotation.id));
      dispatch(clearSelection());
    }
  }

  return (
    <ToolbarToolButton
      icon={<IconAnchorSnap fontSize="small" />}
      label={isActive ? "Annuler l'ancrage" : "Ancrer sur un voisin"}
      onClick={handleClick}
      accentColor={accentColor}
      active={isActive}
    />
  );
}
