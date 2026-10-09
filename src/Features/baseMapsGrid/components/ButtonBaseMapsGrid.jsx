import { Box, IconButton, Paper, Tooltip } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// Floating icon button of the top-right rows of the editors (2D, 3D, base
// maps grid): 36 px square, icon in the MUI action color (`action.active`,
// the default of IconButton) rather than the raw text black.
// `active`: the button stands for the displayed state (grid opened) — the
// action color becomes the background, the icon turns white.
// `shortcut`: key reminder, same badge as the "T" of the 2D/3D toggle — hung
// UNDER the button here, since the button sits against the top edge.
export const FLOATING_BUTTON_PADDING = "6px";

export default function ButtonBaseMapsGrid({
  title,
  icon,
  active,
  disabled,
  shortcut,
  onClick,
}) {
  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "relative",
        borderRadius: "10px",
        ...(active && { bgcolor: "action.active", color: "common.white" }),
      }}
    >
      {shortcut && (
        <Box
          sx={{
            position: "absolute",
            bottom: -14,
            right: -6,
            transform: "scale(0.75)",
            transformOrigin: "bottom right",
            pointerEvents: "none",
            zIndex: 1,
            bgcolor: "background.paper",
            borderRadius: "6px",
            lineHeight: 0,
          }}
        >
          <ShortcutBadge>{shortcut}</ShortcutBadge>
        </Box>
      )}
      <Tooltip title={title}>
        <span>
          <IconButton
            color={active ? "inherit" : "default"}
            disabled={disabled}
            onClick={onClick}
            sx={{ p: FLOATING_BUTTON_PADDING }}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    </Paper>
  );
}
