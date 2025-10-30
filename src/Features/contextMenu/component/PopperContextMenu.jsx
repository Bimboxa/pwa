import { useSelector, useDispatch } from "react-redux";

import { setAnchorPosition } from "Features/contextMenu/contextMenuSlice";

import { Box } from "@mui/material";
import PopperBox from "Features/layout/components/PopperBox";
import SectionAnnotationTemplatesInPanelCreateLocatedEntity from "Features/locatedEntities/components/SectionAnnotationTemplatesInPanelCreateLocatedEntity";

export default function PopupContextMenu() {
  // data

  const dispatch = useDispatch();
  const anchorPosition = useSelector((s) => s.contextMenu.anchorPosition);

  // helpers

  const open = Boolean(anchorPosition);

  // handlers

  function handleClose() {
    dispatch(setAnchorPosition(null));
  }

  // return

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
    >
      <Box sx={{ width: 400, maxHeight: 600, overflow: "auto" }}>
        <SectionAnnotationTemplatesInPanelCreateLocatedEntity
          onClose={handleClose}
        />
      </Box>
    </PopperBox>
  );
}
