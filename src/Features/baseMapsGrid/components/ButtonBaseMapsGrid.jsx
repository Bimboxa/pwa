import { Box, IconButton, Paper, Tooltip } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// Floating icon button of the grid (same look as ButtonZoomOutMap).
// `active`: the button stands for the displayed state (grid opened).
// `shortcut`: key reminder, same badge as the "T" of the 2D/3D toggle — hung
// UNDER the button here, since the button sits against the top edge.
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
        ...(active && { bgcolor: "grey.900", color: "common.white" }),
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
            size="small"
            color="inherit"
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    </Paper>
  );
}
