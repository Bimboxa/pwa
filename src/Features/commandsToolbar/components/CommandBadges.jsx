import { Box, Chip } from "@mui/material";

// Badges of a command: the editor it is restricted to (2D / 3D) when it is
// not available in both, and its hotkey letter. Shared by the rows of the
// « Commandes » dialog and the title of the helper dialog.
export default function CommandBadges({ command }) {
  // helpers

  const hotkey = command.hotkey?.key ? command.hotkey.key.toUpperCase() : null;
  const editor =
    command.editors && command.editors.length === 1 ? command.editors[0] : null;

  // render

  if (!editor && !hotkey) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {editor && (
        <Chip
          label={editor}
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: 10, "& .MuiChip-label": { px: 0.75 } }}
        />
      )}
      {hotkey && (
        <Box
          component="span"
          sx={{
            px: "4px",
            minWidth: 16,
            height: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "4px",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            color: "text.secondary",
          }}
        >
          {hotkey}
        </Box>
      )}
    </Box>
  );
}
