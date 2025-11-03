import { useDispatch } from "react-redux";

import { setAnchorPosition } from "Features/contextMenu/contextMenuSlice";
import { setClickedNode } from "Features/contextMenu/contextMenuSlice";

import { Paper } from "@mui/material";

import SectionSelectAnnotationTemplateToCreateEntity from "./SectionSelectAnnotationTemplateToCreateEntity";

export default function ContextMenuCreateEntity() {
  const dispatch = useDispatch();

  // handlers

  function handleSelected(annotationTemplate) {
    console.log("handleSelected", annotationTemplate);

    dispatch(setAnchorPosition(null));
    dispatch(setClickedNode(null));
  }

  // return

  return (
    <Paper sx={{ width: 300 }}>
      <SectionSelectAnnotationTemplateToCreateEntity
        onSelected={handleSelected}
      />
    </Paper>
  );
}
