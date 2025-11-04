import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotationPoint from "../hooks/useDeleteAnnotationPoint";
import useChangeAnnotationPointType from "../hooks/useChangeAnnotationPointType";

import { Paper, ListItemButton, List, Typography } from "@mui/material";

export default function ContextMenuPolylinePoint() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const deleteAnnotationPoint = useDeleteAnnotationPoint();
  const changeAnnotationPointType = useChangeAnnotationPointType();

  // helpers

  const actions = [
    { label: "Rond <=> Carré", handler: handleChangePointType },
    { label: "Supprimer le point", handler: handleDeletePoint },
  ];

  // handlers
  async function handleChangePointType(e) {
    e.preventDefault();
    e.stopPropagation();
    await changeAnnotationPointType(clickedNode.id, clickedNode.pointIndex);
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  async function handleDeletePoint() {
    await deleteAnnotationPoint(clickedNode.id, clickedNode.pointIndex);
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
