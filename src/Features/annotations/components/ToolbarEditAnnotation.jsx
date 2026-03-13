import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setCanTransformNode, setWrapperMode } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useDeleteAnnotation from "../hooks/useDeleteAnnotation";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";

import {
  Box,
  IconButton,
  Menu,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";

import getAnnotationColor from "../utils/getAnnotationColor";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

export default function ToolbarEditAnnotation() {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
  const { candidates: annotationTemplates, listings } =
    useAnnotationTemplateCandidates(selectedAnnotation) ?? {};

  const wrapperMode = useSelector((s) => s.mapEditor.wrapperMode);

  // state

  const [cloneAnchorEl, setCloneAnchorEl] = useState(null);

  // helpers

  const accentColor = getAnnotationColor(selectedAnnotation) || "#6366F1";
  const label =
    selectedAnnotation?.templateLabel ||
    selectedAnnotation?.annotationTemplateProps?.label ||
    selectedAnnotation?.label ||
    "-";

  // useEffect

  useEffect(() => {
    dispatch(setWrapperMode(false));
    return () => {
      dispatch(setCanTransformNode(false));
      dispatch(setWrapperMode(false));
    };
  }, [selectedAnnotation?.id]);

  // handlers

  function handleEditClick() {
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleCloneClick(event) {
    setCloneAnchorEl(event.currentTarget);
  }

  function handleCloneClose() {
    setCloneAnchorEl(null);
  }

  async function handleCloneTemplateChange(annotationTemplateId) {
    const template = annotationTemplates?.find(
      (t) => t.id === annotationTemplateId
    );
    const newAnnotation = {
      ...getAnnotationTemplateProps(template),
      annotationTemplateId: template?.id,
      label: template?.label,
    };
    // Derive the correct annotation type from the target template drawingShape
    const drawingShape = template?.drawingShape ?? template?.type;
    if (drawingShape === "POLYLINE_2D") newAnnotation.type = "POLYLINE";
    else if (drawingShape === "SURFACE_2D") newAnnotation.type = "POLYGON";
    else if (drawingShape === "POINT_2D") newAnnotation.type = "MARKER";

    await cloneAnnotationAndEntity(selectedAnnotation, { newAnnotation });
    handleCloneClose();
  }

  function handleResizeClick() {
    dispatch(setWrapperMode(!wrapperMode));
  }

  async function handleDeleteClick() {
    if (!selectedAnnotation?.id) return;
    await deleteAnnotation(selectedAnnotation.id);
    dispatch(clearSelection());
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          minWidth: 230,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.25,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <AnnotationTemplateIcon template={selectedAnnotation || {}} size={16} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </Typography>
            <AnnotationMeasurements annotation={selectedAnnotation} />
          </Box>

          <Tooltip title="Éditer le modèle">
            <IconButton
              size="small"
              onClick={handleEditClick}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Actions row */}
        <ToolbarAnnotationActions
          accentColor={accentColor}
          onClone={handleCloneClick}
          onResize={handleResizeClick}
          resizeActive={wrapperMode}
          onDelete={handleDeleteClick}
        />

        {/* Clone template selector menu */}
        <Menu
          open={Boolean(cloneAnchorEl)}
          anchorEl={cloneAnchorEl}
          onClose={handleCloneClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={selectedAnnotation?.annotationTemplateId}
            onChange={handleCloneTemplateChange}
            annotationTemplates={annotationTemplates}
            listings={listings}
          />
        </Menu>
      </Paper>

    </Box>
  );
}
