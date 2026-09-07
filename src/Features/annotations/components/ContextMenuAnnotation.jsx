import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

import useMoveAnnotation from "../hooks/useMoveAnnotation";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

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
  ];

  // helpers - show

  const showStrokeOffset =
    annotation?.type === "POLYLINE" && !annotation?.closeLine;

  // handlers

  function handleEdit() {
    // Select the annotation and open its properties panel (same dispatch set
    // as useSelectAnnotationFromPanel).
    if (annotation) {
      dispatch(
        setSelectedNode({
          nodeId: annotation.id,
          nodeType: "ANNOTATION",
          nodeListingId: annotation.listingId,
          annotationType: annotation.type,
          origin: "CONTEXT_MENU",
        })
      );
      dispatch(
        setSelectedItem({
          id: annotation.id,
          type: "NODE",
          nodeType: "ANNOTATION",
          nodeId: annotation.id,
          annotationType: annotation.type,
          listingId: annotation.listingId,
          annotationTemplateId: annotation.annotationTemplateId,
        })
      );
      dispatch(setShowAnnotationsProperties(true));
    }
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
        {actions.map(({ label, handler, isDivider, disabled }, idx) => {
          if (isDivider) return <Divider key={idx} />;
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
