import { Box } from "@mui/material";

/**
 * Small keyboard shortcut chip used on the right of options rows
 * inside CardLoupe and CardSmartDetect. Mirrors the style of the
 * shortcut badges in SectionShortcutHelpers.
 */
export default function ShortcutBadge({ children }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 24,
        height: 22,
        px: 0.5,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: "text.disabled",
        backgroundColor: (theme) => theme.palette.action.hover,
        borderBottomWidth: "3px",
        color: "text.primary",
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "0.7rem",
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}
