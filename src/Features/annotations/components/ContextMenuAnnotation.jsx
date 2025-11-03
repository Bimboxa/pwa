import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import useMoveAnnotation from "../hooks/useMoveAnnotation";

import { Paper, ListItemButton, List, Typography } from "@mui/material";

export default function ContextMenuAnnotation() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const moveAnnotation = useMoveAnnotation();

  // helpers

  const actions = [
    { label: "Ajouter un objet", handler: handleAddEntity },
    { label: "Avancer au 1er plan", handler: handleMoveTop },
    { label: "Reculer à l'arrière plan", handler: handleMoveBottom },
  ];

  // handlers

  function handleAddEntity() {
    dispatch(setOpenDialogAutoSelectAnnotationTemplateToCreateEntity(true));
    dispatch(setAnchorPosition(null));
  }

  async function handleMoveTop(e) {
    await moveAnnotation(
      {
        id: clickedNode.id,
        listingId: clickedNode.nodeListingId,
      },
      "top"
    );
    //
    dispatch(setSelectedNode(null));
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  async function handleMoveBottom() {
    await moveAnnotation(
      {
        id: clickedNode.id,
        listingId: clickedNode.nodeListingId,
      },
      "bottom"
    );
    //
    dispatch(setSelectedNode(null));
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  // return

  return (
    <Paper>
      <List dense>
        {actions.map(({ label, handler }) => {
          return (
            <ListItemButton key={label} onClick={handler}>
              <Typography variant="body2">{label}</Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}
