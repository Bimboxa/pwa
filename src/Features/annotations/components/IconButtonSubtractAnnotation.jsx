import { useDispatch, useSelector } from "react-redux";

import { setSubtractSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import { IconButton, Tooltip } from "@mui/material";

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
    <Tooltip
      title={
        isActive ? "Annuler la soustraction" : "Soustraire une annotation"
      }
    >
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          color: isActive ? accentColor : "text.disabled",
          bgcolor: isActive ? accentColor + "18" : "transparent",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <IconSubtract fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
