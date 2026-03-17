import { useDispatch, useSelector } from "react-redux";

import { setAnchorSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import { IconButton, Tooltip } from "@mui/material";

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
    <Tooltip title={isActive ? "Annuler l'ancrage" : "Ancrer sur un voisin"}>
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
        <IconAnchorSnap fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
