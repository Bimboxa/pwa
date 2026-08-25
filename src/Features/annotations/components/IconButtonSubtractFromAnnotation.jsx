import { useDispatch, useSelector } from "react-redux";

import { setSubtractTargetAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import { IconButton, Tooltip } from "@mui/material";

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
    <Tooltip title={isActive ? "Annuler la soustraction" : "À soustraire de…"}>
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
        <IconSubtractFrom fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
