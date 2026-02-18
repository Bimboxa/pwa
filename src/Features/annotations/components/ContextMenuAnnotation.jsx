import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { setOpenDialogAutoSelectAnnotationTemplateToCreateEntity } from "Features/mapEditor/mapEditorSlice";

import useMoveAnnotation from "../hooks/useMoveAnnotation";
import useOnEntityEdit from "Features/entities/hooks/useOnEntityEdit";

import { useLiveQuery } from "dexie-react-hooks";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";
import getAnnotationEntityAsync from "Features/entities/services/getAnnotationEntityAsync";

import {
  Paper,
  ListItemButton,
  List,
  Typography,
  Divider,
  Box,
} from "@mui/material";
import SectionAnnotationStrokeOffset from "./SectionAnnotationStrokeOffset";

export default function ContextMenuAnnotation() {
  const dispatch = useDispatch();

  // data

  const clickedNode = useSelector((s) => s.contextMenu.clickedNode);
  const moveAnnotation = useMoveAnnotation();
  const appConfig = useAppConfig();

  const onEntityEdit = useOnEntityEdit();

  // helpers - annotation

  const annotation = useLiveQuery(async () => {
    if (!clickedNode?.id) return null;
    return await db.annotations.get(clickedNode.id);
  }, [clickedNode?.id]);

  console.log("[ContextMenuAnnotation] clicked annotation", annotation)

  // helpers

  const actions = [
    { label: "Avancer au 1er plan", handler: handleMoveTop },
    { label: "Reculer à l'arrière plan", handler: handleMoveBottom },
    { isDivider: true },
    { label: "Editer les propriétés", handler: handleEdit },
    //{ label: "Ajouter un objet", handler: handleAddEntity },
  ];

  // helpers - show

  const showStrokeOffset =
    annotation?.type === "POLYLINE" && !annotation?.closeLine;

  // handlers

  async function handleEdit() {
    const entity = await getAnnotationEntityAsync(annotation, appConfig);
    console.log("debug_1311_entity", entity);
    if (entity) {
      onEntityEdit(entity);
    }
    dispatch(setAnchorPosition(null));
  }

  function handleAddEntity() {
    dispatch(setOpenDialogAutoSelectAnnotationTemplateToCreateEntity(true));
    dispatch(setAnchorPosition(null));
  }

  async function handleMoveTop(e) {
    await moveAnnotation(
      annotation,
      "top"
    );
    //
    dispatch(setSelectedNode(null));
    dispatch(setClickedNode(null));
    dispatch(setAnchorPosition(null));
  }

  async function handleMoveBottom() {
    await moveAnnotation(
      annotation,
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
      {showStrokeOffset && (
        <Box
          sx={{
            p: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SectionAnnotationStrokeOffset annotation={annotation} />
        </Box>
      )}

      <List dense>
        {actions.map(({ label, handler, isDivider }, idx) => {
          if (isDivider) return <Divider key={idx} />;
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
