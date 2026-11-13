import { Box, Chip, Tooltip } from "@mui/material";
import HighlightAltIcon from "@mui/icons-material/HighlightAlt";

// Badges of a command: the selection mark of a `usesSelection` command (kept
// in the context-filtered toolbar while annotations are selected), the editor it is
// restricted to (2D / 3D) when it is not available in both, and its hotkey
// letter. Shared by the rows of the
// « Commandes » dialog and the title of the helper dialog.
export default function CommandBadges({ command }) {
  // strings

  const selectionS = "Agit sur la sélection";

  // helpers

  const usesSelection = Boolean(command.usesSelection);

  const hotkey = command.hotkey?.key ? command.hotkey.key.toUpperCase() : null;
  const editor =
    command.editors && command.editors.length === 1 ? command.editors[0] : null;

  // render

  if (!usesSelection && !editor && !hotkey) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {usesSelection && (
        <Tooltip title={selectionS} enterDelay={400}>
          <HighlightAltIcon
            aria-label={selectionS}
            sx={{ fontSize: 14, color: "text.secondary" }}
          />
        </Tooltip>
      )}
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
