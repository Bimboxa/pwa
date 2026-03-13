import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedNodes from "../hooks/useSelectedNodes";

import db from "App/db/db";
import { Box } from "@mui/material";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";
import ToolbarEditAnnotationVariantBaseMapAnnotation from "Features/annotations/components/ToolbarEditAnnotationVariantBaseMapAnnotation";


export default function PopperEditAnnotation({ viewerKey = null }) {
  // data

  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );

  const { node: selectedNode } = useSelectedNodes();

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedAnnotation = useSelectedAnnotation();
  const selectedItems = useSelector(selectSelectedItems);

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
    Boolean(anchorPosition) &&
    ["MARKER", "POINT", "POLYLINE", "POLYGON", "IMAGE", "RECTANGLE", "STRIP"].includes(type) &&
    selectedNode?.nodeType === "ANNOTATION";

  // helper - isBaseMapAnnotation

  const listing = useLiveQuery(
    () => selectedAnnotation?.listingId ? db.listings.get(selectedAnnotation.listingId) : null,
    [selectedAnnotation?.listingId]
  );
  const isBaseMapAnnotation = listing?.isForBaseMaps === true;

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
        {!isBaseMapAnnotation ? (
          <ToolbarEditAnnotation />
        ) : (
          <ToolbarEditAnnotationVariantBaseMapAnnotation />
        )}
      </Box>
    </Box>
  );
}
