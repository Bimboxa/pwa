import { Box, Tooltip, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// ButtonCountPill — count pill that toggles a visibility (listing rows, the
// active listing band, the « Annotations sans modèle » row): filled in the
// accent while visible, outlined while hidden. With a count of 0 the pill
// has no background nor border — just the figure, in the accent while
// visible, greyed (like the hidden row's name) while hidden.
// ---------------------------------------------------------------------------

export default function ButtonCountPill({
  count = 0,
  hidden = false,
  title = "",
  onClick,
  accent = "secondary.main",
  contrastColor = "secondary.contrastText",
}) {
  // helpers

  const empty = !count;

  const colorSx = empty
    ? {
        borderColor: "transparent",
        bgcolor: "transparent",
        color: hidden ? "text.disabled" : accent,
        "&:hover": { bgcolor: "action.hover" },
      }
    : {
        borderColor: hidden ? "panel.border" : "transparent",
        bgcolor: hidden ? "transparent" : accent,
        color: hidden ? "text.disabled" : contrastColor,
        "&:hover": {
          filter: "brightness(1.1)",
          borderColor: hidden ? "text.secondary" : "transparent",
        },
      };

  // render

  return (
    <Tooltip title={title} arrow placement="top">
      <Box
        component="button"
        // No focus on click: a focused pill would hand its focus-visible
        // state to the host ListItemButton (grey "Mui-focusVisible"
        // overlay on the row) at the next keystroke.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        sx={{
          minWidth: 24,
          height: 20,
          px: 0.75,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: 999,
          border: "1px solid",
          cursor: "pointer",
          transition: "0.2s",
          ...colorSx,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontFamily: "monospace",
            lineHeight: 1,
            color: "inherit",
          }}
        >
          {count}
        </Typography>
      </Box>
    </Tooltip>
  );
}
