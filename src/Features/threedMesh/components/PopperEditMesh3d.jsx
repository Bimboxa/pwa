import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";
import useToolbarDrag from "Features/mapEditor/hooks/useToolbarDrag";

import { Box } from "@mui/material";

import ToolbarEditMesh3d from "./ToolbarEditMesh3d";
import { matchesActiveViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Floating edit toolbar for a single selected maille. Mirrors
// PopperEditDimension: shown only in the matching viewer when exactly one
// MESH3D node is selected. Draggable via the shared toolbar-drag offset.
export default function PopperEditMesh3d({ viewerKey = null }) {
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedItems = useSelector(selectSelectedItems);

  const shouldShow = viewerKey
    ? matchesActiveViewerKey(viewerKey, activeViewerKey)
    : activeViewerKey === "MAP";

  const isSingleSelection = selectedItems.length === 1;
  const item = isSingleSelection ? selectedItems[0] : null;
  const isMesh3d = item?.type === "NODE" && item?.nodeType === "MESH3D";

  const { dragOffset, isDragging, handleDragStart } = useToolbarDrag();

  const open = shouldShow && isSingleSelection && isMesh3d;
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
        <ToolbarEditMesh3d onDragStart={handleDragStart} />
      </Box>
    </Box>
  );
}
