import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useIsWidestCoupledTab from "Features/layout/hooks/useIsWidestCoupledTab";
import useSelectedNodes from "../hooks/useSelectedNodes";
import useToolbarDrag from "../hooks/useToolbarDrag";

import { Box } from "@mui/material";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";


export default function PopperEditAnnotation({ viewerKey = null }) {
  // data

  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );

  const { node: selectedNode } = useSelectedNodes();

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedAnnotation = useSelectedAnnotation();
  const selectedItems = useSelector(selectSelectedItems);
  const isWidest = useIsWidestCoupledTab();

  // Note: used annotationType if available in item (it wasn't in InteractionLayer), falling back to selectedAnnotation logic
  const type = selectedNode?.annotationType || selectedAnnotation?.type;

  // helpers

  // Only show if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  // Only show single toolbar when exactly 1 item is selected (not multi-selection)
  const isSingleSelection = selectedItems.length === 1;

  const open =
    shouldShow &&
    isSingleSelection &&
    isWidest &&
    ["MARKER", "POINT", "POLYLINE", "POLYGON", "IMAGE", "RECTANGLE", "STRIP", "OBJECT_3D"].includes(type) &&
    selectedNode?.nodeType === "ANNOTATION";

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
        <ToolbarEditAnnotation onDragStart={handleDragStart} />
      </Box>
    </Box>
  );
}
