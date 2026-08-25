import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import SectionPasteHelperContent from "Features/mapEditor/components/SectionPasteHelperContent";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// ---------------------------------------------------------------------------
// SectionPanelPasteHelper — copy/paste-mode content of the Dessin panel
// (replaces the panel content while a paste is armed, like the floating
// PopperPasteHelper does for the popper).
// ---------------------------------------------------------------------------

export default function SectionPanelPasteHelper() {
  // strings

  const titleS = "Mode copier/coller";
  const quitS = "Quitter";

  // data

  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const copiedCount = pasteClipboard?.items?.length ?? 0;

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "panel.border",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "panel.textPrimary" }}
        >
          {titleS}
        </Typography>
        <Typography
          variant="caption"
          sx={{ flex: 1, color: "panel.textLight", fontWeight: 600 }}
          noWrap
        >
          {copiedCount > 1 ? `${copiedCount} annotations` : "1 annotation"}
        </Typography>
        <Typography variant="caption" sx={{ color: "panel.textMuted" }}>
          {quitS}
        </Typography>
        <ShortcutBadge>Esc</ShortcutBadge>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <SectionPasteHelperContent />
      </Box>
    </Box>
  );
}
