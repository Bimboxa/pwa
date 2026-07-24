import { Box } from "@mui/material";

// Tiny keycap badge shown next to a compact drawing-toolbar field (Ep. / ht.)
// to advertise its keyboard shortcut (E / H). Turns solid primary while that
// field is the active typed-entry target. Matches the small tool-icon hotkey
// badges in ToolbarDrawingDraft rather than the larger SectionShortcutHelpers
// ShortcutBadge, so it stays legible inside the compact toolbar row.
export default function FieldShortcutBadge({ children, active = false }) {
  return (
    <Box
      component="span"
      sx={{
        minWidth: 13,
        height: 13,
        px: "2px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid",
        borderColor: active ? "primary.main" : "divider",
        borderRadius: "3px",
        bgcolor: active ? "primary.main" : "background.paper",
        color: active ? "primary.contrastText" : "text.secondary",
        fontSize: 8,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}
