import { useMemo, useState } from "react";

import { IconButton, Menu, Tooltip } from "@mui/material";
import { MoreHoriz as MoreIcon } from "@mui/icons-material";

import ToolbarToolsContext from "./ToolbarToolsContext";

// "More" button of the annotation toolbar: opens a menu listing the same
// tools as the row (children = a second EditAnnotationTools instance),
// rendered as MenuItems through ToolbarToolsContext.
// - Lazy mount: children are rendered only after the first opening so the
//   tools' hooks are not doubled until the menu is actually used.
// - keepMounted: the tool instances stay mounted after the menu closes so a
//   Popover / Menu / Dialog they opened (anchored on this button) survives.
// The parent passes key={annotationId} so everything resets per annotation.
// variant "overlay": circular white button with a colored border, matching
// the quick-action row rendered above the annotation (NodeSegmentLengthsStatic).
export default function IconButtonMoreAnnotationTools({
  accentColor,
  variant = "toolbar",
  overlayColor = "#2196f3",
  children,
}) {
  // state

  const [buttonEl, setButtonEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // helpers

  const ctxValue = useMemo(
    () => ({
      variant: "menu",
      anchorEl: buttonEl,
      closeMenu: () => setOpen(false),
    }),
    [buttonEl]
  );

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
        "&:hover": { bgcolor: "white" },
        p: 0.5,
      }
    : {
        color: open ? accentColor : "text.disabled",
        bgcolor: open ? accentColor + "18" : "transparent",
        "&:hover": {
          color: accentColor,
          bgcolor: accentColor + "18",
        },
      };

  return (
    <>
      <Tooltip
        title="Plus d'outils"
        placement={isOverlay ? "top" : "bottom"}
        arrow={isOverlay}
      >
        <IconButton
          ref={setButtonEl}
          size="small"
          onClick={handleOpen}
          sx={buttonSx}
        >
          {isOverlay ? (
            <MoreIcon sx={{ fontSize: 18 }} />
          ) : (
            <MoreIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={buttonEl}
        onClose={handleClose}
        keepMounted
        anchorOrigin={{
          vertical: "bottom",
          horizontal: isOverlay ? "center" : "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: isOverlay ? "center" : "right",
        }}
        slotProps={{ paper: { sx: { minWidth: 260, maxHeight: 480 } } }}
      >
        {hasOpened ? (
          <ToolbarToolsContext.Provider value={ctxValue}>
            {children}
          </ToolbarToolsContext.Provider>
        ) : null}
      </Menu>
    </>
  );
}
