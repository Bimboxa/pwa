import { useState } from "react";

import { IconButton, Tooltip } from "@mui/material";
import { ContentCopy as CloneIcon } from "@mui/icons-material";

import CloneAnnotationFlow from "./CloneAnnotationFlow";

// "Dupliquer" button of the selected annotation + its clone flow (menu or
// wall-piece chooser, see CloneAnnotationFlow).
// - variant "overlay": circular white button with a colored border, in the
//   quick-action row rendered above the annotation (NodeSegmentLengthsStatic,
//   before "Plus d'outils").
// - variant "toolbar": plain icon in the ToolbarEditAnnotation actions row,
//   kept for the annotations that have no overlay row.
// The flow (and its annotations / templates hooks) is mounted on the first
// click only. The parent passes key={annotationId} so it resets per annotation.
export default function ButtonCloneAnnotation({
  variant = "toolbar",
  accentColor,
  overlayColor = "#2196f3",
  disabled = false,
  tooltip,
}) {
  // state

  const [buttonEl, setButtonEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // handlers

  function handleOpen() {
    setHasOpened(true);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  // render

  const isOverlay = variant === "overlay";
  const buttonSx = isOverlay
    ? {
        bgcolor: "rgba(255,255,255,0.9)",
        border: `1px solid ${overlayColor}`,
        color: open ? overlayColor : "text.disabled",
        "&:hover": { bgcolor: "white", color: overlayColor },
        p: 0.5,
      }
    : {
        color: "text.disabled",
        "&:hover": {
          color: accentColor,
          bgcolor: accentColor + "18",
        },
      };

  return (
    <>
      <Tooltip
        title={tooltip || "Dupliquer"}
        placement={isOverlay ? "top" : "bottom"}
        arrow={isOverlay}
      >
        <span style={{ display: "inline-flex" }}>
          <IconButton
            ref={setButtonEl}
            size="small"
            onClick={handleOpen}
            disabled={disabled}
            sx={buttonSx}
          >
            {isOverlay ? (
              <CloneIcon sx={{ fontSize: 18 }} />
            ) : (
              <CloneIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {hasOpened && (
        <CloneAnnotationFlow
          open={open}
          onClose={handleClose}
          anchorEl={buttonEl}
          accentColor={accentColor}
          menuAlign={isOverlay ? "center" : "right"}
        />
      )}
    </>
  );
}
