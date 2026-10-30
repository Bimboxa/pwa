import { Box } from "@mui/material";

// Keyboard key chip of the drawing helpers (SectionShortcutHelpers rows, the
// 3D axis lock card): a small raised key cap. `filled` paints it with
// `color` (an active lock); `disabled` greys it out.
export default function KeyChip({
  children,
  filled = false,
  color,
  disabled = false,
  sx,
}) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "28px",
        height: "24px",
        px: 0.5,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: filled ? color : "text.disabled",
        backgroundColor: filled ? color : (theme) => theme.palette.action.hover,
        borderBottomWidth: "3px",
        color: filled ? "#fff" : disabled ? "text.disabled" : "text.primary",
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "0.75rem",
        lineHeight: 1,
        opacity: disabled ? 0.6 : 1,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
