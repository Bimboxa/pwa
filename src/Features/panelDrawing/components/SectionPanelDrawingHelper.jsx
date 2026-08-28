import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import SectionDrawingHelperContent from "Features/mapEditor/components/SectionDrawingHelperContent";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// SectionPanelDrawingHelper — drawing-mode content of the Dessin panel
// (replaces the template list while a drawing mode is armed, like the
// floating PopperDrawingHelper does for the popper).
//
// 2D editor: the content is NOT rendered here — the panel only hosts an empty
// div that MainMapEditorV3's PanelDrawingHelperPortal fills, so the content
// stays inside the editor's SmartZoomProvider (loupe) while displaying in the
// panel. 3D-toggled editor: no such dependency, direct render.
// ---------------------------------------------------------------------------

export const PANEL_DRAWING_HELPER_HOST_ID = "panel-drawing-helper-host";

export default function SectionPanelDrawingHelper() {
  // data

  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // strings

  const titleS = "Mode dessin";
  const quitS = "Terminer / Quitter";

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
          sx={{ flex: 1, fontWeight: 600, color: "panel.textPrimary" }}
        >
          {titleS}
        </Typography>
        <Typography variant="caption" sx={{ color: "panel.textMuted" }}>
          {quitS}
        </Typography>
        <ShortcutBadge>Esc</ShortcutBadge>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {isThreedEditor ? (
          <SectionDrawingHelperContent />
        ) : (
          <Box id={PANEL_DRAWING_HELPER_HOST_ID} />
        )}
      </Box>
    </Box>
  );
}
