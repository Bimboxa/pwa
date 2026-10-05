import { useDispatch } from "react-redux";

import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";

import { Box, IconButton, Tooltip } from "@mui/material";

import IconHollowOut from "./IconHollowOut";

// "Evider" button of the quick-action row rendered above the selected POLYGON
// (NodeSegmentLengthsStatic overlay, before "Plus d'outils"). Opens the carve
// dialog (DialogHollowOutAnnotation) — same action as the "E" shortcut, hence
// the hotkey badge on the top-right corner. `showHotkey={false}` in the 3D
// editor, where "E" belongs to other tools (Extruder / Élévation).
export default function OverlayButtonHollowOutAnnotation({
  annotation,
  overlayColor = "#2196f3",
  showHotkey = true,
}) {
  const dispatch = useDispatch();

  // handlers

  function handleClick() {
    if (!annotation?.id) return;
    dispatch(setHollowOutDialogAnnotationId(annotation.id));
  }

  // render

  return (
    <Tooltip
      placement="top"
      arrow
      title="Évider (découper par les annotations visibles)"
    >
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          position: "relative",
          bgcolor: "rgba(255,255,255,0.9)",
          border: `1px solid ${overlayColor}`,
          color: "text.disabled",
          "&:hover": { bgcolor: "white", color: overlayColor },
          p: 0.5,
        }}
      >
        <IconHollowOut sx={{ fontSize: 18 }} />
        {showHotkey && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 12,
            height: 12,
            px: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "3px",
            bgcolor: "background.paper",
            fontSize: 8,
            fontWeight: 700,
            lineHeight: 1,
            color: "text.secondary",
          }}
        >
          E
        </Box>
        )}
      </IconButton>
    </Tooltip>
  );
}
