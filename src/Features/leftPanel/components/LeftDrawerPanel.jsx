import { useSelector } from "react-redux";

import { Box } from "@mui/material";

// Left module dock. Rendered in flow only while pinned open from the top bar
// (ButtonToggleLeftPanelDock); hidden otherwise. No hover reveal. Hidden in
// full screen too (ButtonFullScreen) — the docked state is kept, the dock is
// back as it was when the mode is left.
export default function LeftDrawerPanel({ children, width = 260, viewerKey }) {
  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helpers

  const isActiveViewer = !viewerKey || selectedViewerKey === viewerKey;

  // render

  if (!leftPanelDocked || !isActiveViewer || isFullScreen) return null;

  return (
    <Box
      sx={{
        width,
        minWidth: width,
        bgcolor: "background.default",
      }}
    >
      {children}
    </Box>
  );
}
