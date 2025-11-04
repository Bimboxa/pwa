import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotationPoint from "../hooks/useDeleteAnnotationPoint";

import { Paper, ListItemButton, List, Typography } from "@mui/material";

export default function ContextMenuPolylinePoint() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const deleteAnnotationPoint = useDeleteAnnotationPoint();

  // helpers

  const actions = [{ label: "Supprimer le point", handler: handleDeletePoint }];

  // handlers

  async function handleDeletePoint() {
    await deleteAnnotationPoint(clickedNode.id, clickedNode.pointIndex);
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
