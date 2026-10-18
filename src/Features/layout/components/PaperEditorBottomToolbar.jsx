import { useSelector } from "react-redux";

import { Paper } from "@mui/material";

// Floating toolbar at the bottom of the displayed editor (2D or 3D), centred
// on its visible width. Mounted in the editors area of SectionViewer (not in
// the full-width bottom bar), so the in-flow left drawers (Dessin panel…)
// shrink the area and the toolbar follows. The right panel is an overlay
// (RightPanelContainer, right: 100%) that does not shrink the area: shift the
// centre by half its width while it is open, like the bottom-right cluster of
// UILayerDesktop does.
export default function PaperEditorBottomToolbar({ children, sx }) {
  // data

  const rightPanelKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const rightPanelWidth = useSelector((s) => s.rightPanel.width);

  // helpers

  const offset = rightPanelKey ? rightPanelWidth / 2 : 0;

  // render

  return (
    <Paper
      elevation={6}
      data-capture-hide
      sx={{
        position: "absolute",
        // same line as the bottom-left / bottom-right clusters of the editors
        bottom: 16,
        left: `calc(50% - ${offset}px)`,
        transform: "translateX(-50%)",
        transition: "left 0.2s ease",
        // POV / capture bars layer (see editorFloatingPanelsHost.js)
        zIndex: 30,
        borderRadius: 2,
        px: 1,
        py: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        // An absolute box centred with left: 50% only gets half its parent as
        // shrink-to-fit width: size on the content instead, the visible-width
        // cap + overflowX then scroll rather than ellipsize the labels.
        width: "max-content",
        maxWidth: `calc(100% - ${32 + offset * 2}px)`,
        overflowX: "auto",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
