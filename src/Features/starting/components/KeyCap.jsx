import { Box } from "@mui/material";

// Keyboard key chip of the « touches clés » section — the recipe of
// ToolbarHotkeyBadge scaled up to read in a table.
export default function KeyCap({ children, sx }) {
  return (
    <Box
      component="span"
      sx={{
        minWidth: 26,
        height: 26,
        px: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,.12)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        color: "text.primary",
        whiteSpace: "nowrap",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
