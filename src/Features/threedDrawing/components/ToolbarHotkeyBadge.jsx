import { Box } from "@mui/material";

// Small boxed letter appended to a bottom-toolbar button label, mirroring the
// hotkey badges of the 2D drawing tool pickers (ToolbarStartDrawTemplate).
export default function ToolbarHotkeyBadge({ hotkey }) {
  if (!hotkey) return null;
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75,
        minWidth: 16,
        height: 16,
        px: "3px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "4px",
        bgcolor: "background.paper",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        color: "text.secondary",
      }}
    >
      {hotkey}
    </Box>
  );
}
