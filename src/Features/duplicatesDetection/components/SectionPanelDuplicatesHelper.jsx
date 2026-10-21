import { useDispatch } from "react-redux";

import { clearDetection } from "../duplicatesDetectionSlice";

import { Box, Typography } from "@mui/material";

import SectionDuplicatesHelperContent from "./SectionDuplicatesHelperContent";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// ---------------------------------------------------------------------------
// SectionPanelDuplicatesHelper — « Détection des doublons » content of the
// DOCKED Dessin panel (replaces the template list while a run exists, like
// SectionPanelPasteHelper does for the paste mode). Header: title, « Quitter »
// (click or Esc).
// ---------------------------------------------------------------------------

export default function SectionPanelDuplicatesHelper() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Détection des doublons";
  const quitS = "Quitter";

  // handlers

  function handleQuit() {
    dispatch(clearDetection());
  }

  // render

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
    >
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
          sx={{ flex: 1, fontWeight: 600, color: "panel.textPrimary" }}
        >
          {titleS}
        </Typography>
        <Typography
          variant="caption"
          onClick={handleQuit}
          sx={{
            color: "panel.textMuted",
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {quitS}
        </Typography>
        <ShortcutBadge>Esc</ShortcutBadge>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <SectionDuplicatesHelperContent />
      </Box>
    </Box>
  );
}
