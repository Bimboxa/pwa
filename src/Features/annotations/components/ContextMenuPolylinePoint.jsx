import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotationPoint from "../hooks/useDeleteAnnotationPoint";
import useChangeAnnotationPointType from "../hooks/useChangeAnnotationPointType";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

import { Paper, ListItemButton, List, Typography } from "@mui/material";

export default function ContextMenuPolylinePoint() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const currentUserId = useSelector((s) => s.auth.userProfile?.userIdMaster);
  const deleteAnnotationPoint = useDeleteAnnotationPoint();
  const changeAnnotationPointType = useChangeAnnotationPointType();

  // Permission check — vérifie si l'annotation cliquée est à moi
  const annotation = useLiveQuery(async () => {
    if (!clickedNode?.id) return null;
    return await db.annotations.get(clickedNode.id);
  }, [clickedNode?.id]);

  const isOwner =
    annotation?.createdByUserIdMaster === currentUserId ||
    annotation?.createdByUserIdMaster === "anonymous";

  // helpers

  const actions = [
    { label: "Rond <=> Carré", handler: handleChangePointType, disabled: !isOwner },
    { label: "Supprimer le point", handler: handleDeletePoint, disabled: !isOwner },
  ];

  // handlers
  async function handleChangePointType(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwner) return;
    await changeAnnotationPointType(clickedNode.id, clickedNode.pointIndex);
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  async function handleDeletePoint() {
    if (!isOwner) return;
    await deleteAnnotationPoint(clickedNode.id, clickedNode.pointIndex);
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  // return

  return (
    <Paper>
      <List dense>
        {actions.map(({ label, handler, disabled }) => {
          return (
            <ListItemButton key={label} onClick={handler} disabled={disabled}>
              <Typography variant="body2">{label}</Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}
