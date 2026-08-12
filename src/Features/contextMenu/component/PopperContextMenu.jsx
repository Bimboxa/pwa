import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import { Box } from "@mui/material";
import PopperBox from "Features/layout/components/PopperBox";

import ContextMenuAnnotationTemplates from "Features/annotations/components/ContextMenuAnnotationTemplates";
import ContextMenuCreateEntity from "Features/entities/components/ContextMenuCreateEntity";
import ContextMenuPolylinePoint from "Features/annotations/components/ContextMenuPolylinePoint";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

export default function PopupContextMenu() {
  // data

  const dispatch = useDispatch();
  const anchorPosition = useSelector((s) => s.contextMenu.anchorPosition);
  const node = useSelector((s) => s.contextMenu.clickedNode);
  const { value: listing } = useSelectedListing();

  // No context menu while a capture frame owns the screen (Capture tool,
  // Export rapide, POV framing) — same rule as UILayer / PopperMapListings.
  // Also swallows a stale anchor left over from a right-click before capture.
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  // helpers

  const open = Boolean(anchorPosition) && !captureFramingActive;

  // helpers - mode

  let mode = null;
  if (listing?.entityModel?.type !== "LOCATED_ENTITY") {
    mode = null;
  } else if (node?.pointIndex !== undefined) {
    mode = "POLYLINE_POINT";
  } else if (node?.nodeType && node?.nodeType === "ANNOTATION") {
    mode = "ANNOTATION";
  } else {
    mode = "CREATE";
  }

  // handlers

  function handleClose() {
    dispatch(setAnchorPosition(null));
    dispatch(setClickedNode(null));
  }

  // return

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
    >
      {/* {mode === "CREATE" && <ContextMenuCreateEntity />} */}
      {mode === "ANNOTATION" && <ContextMenuAnnotationTemplates />}
      {mode === "POLYLINE_POINT" && <ContextMenuPolylinePoint />}
    </PopperBox>
  );
}
