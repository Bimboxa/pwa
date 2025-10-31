import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";

import { Box } from "@mui/material";
import PopperBox from "Features/layout/components/PopperBox";
import SectionAnnotationTemplatesInPanelCreateLocatedEntity from "Features/locatedEntities/components/SectionAnnotationTemplatesInPanelCreateLocatedEntity";
import ContextMenuAnnotation from "Features/annotations/components/ContextMenuAnnotation";

export default function PopupContextMenu() {
  // data

  const dispatch = useDispatch();
  const anchorPosition = useSelector((s) => s.contextMenu.anchorPosition);
  const node = useSelector((s) => s.contextMenu.clickedNode);

  // helpers

  const open = Boolean(anchorPosition);

  // helpers - mode

  let mode = "CREATE";
  if (node?.nodeType && node?.nodeType === "ANNOTATION") mode = "ANNOTATION";

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
      {mode === "CREATE" && (
        <Box sx={{ width: 300, maxHeight: 600, overflow: "auto" }}>
          <SectionAnnotationTemplatesInPanelCreateLocatedEntity
            onClose={handleClose}
          />
        </Box>
      )}
      {mode === "ANNOTATION" && <ContextMenuAnnotation />}
    </PopperBox>
  );
}
