import { useSelector } from "react-redux";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";
import ToolbarEditAnnotations from "Features/annotations/components/ToolbarEditAnnotations";

export default function PopperEditAnnotations({ viewerKey = null, allAnnotations }) {
  // data

  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationsToolbarPosition
  );

  const selectedItems = useSelector(selectSelectedItems);
  const selectedNodes = selectedItems.map((i) => ({ nodeId: i.nodeId, nodeType: i.type }));

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // Only show if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  const open = shouldShow && Boolean(anchorPosition) && selectedNodes?.length > 1;

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box sx={{ pointerEvents: "auto" }}>
        <ToolbarEditAnnotations allAnnotations={allAnnotations} />
      </Box>
    </Box>
  );
}
