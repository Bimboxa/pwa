import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";
import useToolbarDrag from "Features/mapEditor/hooks/useToolbarDrag";

import { Box } from "@mui/material";

import ToolbarEditMeshes3d from "./ToolbarEditMeshes3d";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { matchesActiveViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Floating edit toolbar shown when 2+ mailles (and nothing else) are
// selected. Same popper pattern as PopperEditAnnotations.
export default function PopperEditMeshes3d({ viewerKey = null }) {
  // Effective key, not the raw module key: the toolbar follows the editor
  // actually displayed (e.g. the Dessin module toggled to its 3D editor).
  const activeViewerKey = useSelector(selectEffectiveViewerKey);
  const selectedItems = useSelector(selectSelectedItems);

  // No edit toolbar while a capture frame owns the screen (Capture tool,
  // Export rapide, POV framing) — same rule as UILayer / PopperMapListings.
  // The selection itself is kept, so the toolbar comes back on exit.
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  const shouldShow = viewerKey
    ? matchesActiveViewerKey(viewerKey, activeViewerKey)
    : activeViewerKey === "MAP";

  const allMeshes3d =
    selectedItems.length >= 2 &&
    selectedItems.every(
      (it) => it?.type === "NODE" && it?.nodeType === "MESH3D"
    );

  const { dragOffset, isDragging, handleDragStart } = useToolbarDrag();

  const open = shouldShow && allMeshes3d && !captureFramingActive;
  if (!open) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px)`,
        zIndex: 1000,
        pointerEvents: "none",
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      <Box sx={{ pointerEvents: "auto" }}>
        <ToolbarEditMeshes3d onDragStart={handleDragStart} />
      </Box>
    </Box>
  );
}
