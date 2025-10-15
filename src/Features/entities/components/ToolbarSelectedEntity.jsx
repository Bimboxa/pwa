import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";

import useSelectedEntity from "../hooks/useSelectedEntity";

import { Paper, Box, Typography, IconButton } from "@mui/material";
import { Edit } from "@mui/icons-material";

import IconButtonClose from "Features/layout/components/IconButtonClose";
import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";
import getEntityOverviewProps from "../utils/getEntityOverviewProps";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

export default function ToolbarSelectedEntity() {
  const dispatch = useDispatch();

  // data

  const { value: entity } = useSelectedEntity({
    withImages: true,
    withAnnotations: true,
  });
  const annotationTemplates = useAnnotationTemplatesByProject();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  console.log("debug_1510_entity", entity);

  // helpers

  const overviewProps = getEntityOverviewProps({
    entity,
    baseMapId,
    annotationTemplates,
  });

  // handlers

  function handleClose() {
    dispatch(setSelectedItem(null));
  }

  function handleEditClick() {
    dispatch(setSelectedMenuItemKey("SELECTION"));
  }

  // render

  return (
    <Paper
      sx={{
        p: 1,
        display: "flex",
        alignItems: "center",
        borderRadius: "8px",
        border: `1px solid ${overviewProps?.color}`,
      }}
    >
      <IconButtonClose onClose={handleClose} />
      <Typography noWrap sx={{ px: 1 }}>
        {overviewProps?.label}
      </Typography>
      <IconButton onClick={handleEditClick}>
        <Edit />
      </IconButton>
    </Paper>
  );
}
