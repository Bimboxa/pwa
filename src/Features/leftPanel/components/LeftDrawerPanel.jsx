import { useSelector } from "react-redux";

import { Box } from "@mui/material";

// Left module dock. Rendered in flow only while pinned open from the top bar
// (ButtonToggleLeftPanelDock); hidden otherwise, and in the compact layout
// (narrow window: editor only). No hover reveal.
export default function LeftDrawerPanel({ children, width = 260, viewerKey }) {
  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const compactLayout = useSelector((s) => s.layout.compactLayout);

  // helpers

  const isActiveViewer = !viewerKey || selectedViewerKey === viewerKey;

  // render

  if (!leftPanelDocked || !isActiveViewer || compactLayout) return null;

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
