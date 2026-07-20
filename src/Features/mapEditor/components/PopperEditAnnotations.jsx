import { useSelector } from "react-redux";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useIsWidestCoupledTab from "Features/layout/hooks/useIsWidestCoupledTab";
import useToolbarDrag from "../hooks/useToolbarDrag";

import { Box } from "@mui/material";
import ToolbarEditAnnotations from "Features/annotations/components/ToolbarEditAnnotations";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { matchesActiveViewerKey } from "Features/viewers/utils/threedViewerKeys";

export default function PopperEditAnnotations({ viewerKey = null, allAnnotations }) {
  // data

  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationsToolbarPosition
  );

  const selectedItems = useSelector(selectSelectedItems);
  const selectedNodes = selectedItems.map((i) => ({ nodeId: i.nodeId, nodeType: i.type }));

  // Effective key, not the raw module key: the toolbar follows the editor
  // actually displayed (e.g. the Dessin module toggled to its 3D editor).
  const activeViewerKey = useSelector(selectEffectiveViewerKey);
  const isWidest = useIsWidestCoupledTab();

  // Only show if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? matchesActiveViewerKey(viewerKey, activeViewerKey)
    : activeViewerKey === "MAP";

  const open = shouldShow && isWidest && selectedNodes?.length > 1;

  // drag

  const { dragOffset, isDragging, handleDragStart } = useToolbarDrag();

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
        <ToolbarEditAnnotations allAnnotations={allAnnotations} onDragStart={handleDragStart} />
      </Box>
    </Box>
  );
}
