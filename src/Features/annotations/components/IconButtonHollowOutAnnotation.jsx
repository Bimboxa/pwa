import { IconButton, Tooltip } from "@mui/material";

import IconHollowOut from "./IconHollowOut";

import useHollowOutAnnotation from "../hooks/useHollowOutAnnotation";

// "Evider": carve the selected POLYGON by the footprints of every visible
// annotation. The carve itself lives in useHollowOutAnnotation, shared with
// the "E" keyboard shortcut (InteractionLayer).
export default function IconButtonHollowOutAnnotation({
  annotation,
  accentColor,
}) {
  // handlers

  const hollowOutAnnotation = useHollowOutAnnotation();

  // render

  return (
    <Tooltip title="Evider (découper par les annotations visibles) — E">
      <IconButton
        size="small"
        onClick={() => hollowOutAnnotation(annotation)}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <IconHollowOut fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
