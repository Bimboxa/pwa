import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import { Box } from "@mui/material";
import PopperBox from "Features/layout/components/PopperBox";

import ContextMenuAnnotation from "Features/annotations/components/ContextMenuAnnotation";
import ContextMenuCreateEntity from "Features/entities/components/ContextMenuCreateEntity";
import ContextMenuPolylinePoint from "Features/annotations/components/ContextMenuPolylinePoint";

export default function PopupContextMenu() {
  // data

  const dispatch = useDispatch();
  const anchorPosition = useSelector((s) => s.contextMenu.anchorPosition);
  const node = useSelector((s) => s.contextMenu.clickedNode);

  // helpers

  const open = Boolean(anchorPosition);

  // helpers - mode

  let mode = "CREATE";
  if (node?.pointIndex !== undefined) {
    mode = "POLYLINE_POINT";
  } else if (node?.nodeType && node?.nodeType === "ANNOTATION") {
    mode = "ANNOTATION";
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
      {mode === "CREATE" && <ContextMenuCreateEntity />}
      {mode === "ANNOTATION" && <ContextMenuAnnotation />}
      {mode === "POLYLINE_POINT" && <ContextMenuPolylinePoint />}
    </PopperBox>
  );
}
