import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setCanTransformNode, setWrapperMode } from "Features/mapEditor/mapEditorSlice";
import { clearSelection, setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useDeleteAnnotation from "../hooks/useDeleteAnnotation";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import {
  Box,
  IconButton,
  Menu,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  ArrowDropDown as ArrowDropDownIcon,
  SettingsOutlined as SettingsIcon,
} from "@mui/icons-material";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import IconButtonFlipStripAnnotation from "./IconButtonFlipStripAnnotation";
import IconButtonAnchorAnnotation from "./IconButtonAnchorAnnotation";

import getAnnotationColor from "../utils/getAnnotationColor";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import { resolveDrawingShape, getAnnotationType } from "../constants/drawingShapeConfig";

export default function ToolbarEditAnnotation({ onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
  const updateAnnotation = useUpdateAnnotation();

  // Template candidates: same type for the dropdown, compatible for clone
  const { candidates: sameTypeCandidates, listings: sameTypeListings } =
    useAnnotationTemplateCandidates(selectedAnnotation, {
      variant: "sameType",
    }) ?? {};
  const { candidates: cloneCandidates, listings: cloneListings } =
    useAnnotationTemplateCandidates(selectedAnnotation) ?? {};

  const wrapperMode = useSelector((s) => s.mapEditor.wrapperMode);

  // state

  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
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

  function handleTemplateDropdownClick(event) {
    event.stopPropagation();
    setTemplateAnchorEl(event.currentTarget);
  }

  function handleTemplateDropdownClose() {
    setTemplateAnchorEl(null);
  }

  async function handleTemplateChange(annotationTemplateId) {
    const template = sameTypeCandidates?.find(
      (t) => t.id === annotationTemplateId
    );
    if (!template || !selectedAnnotation?.id) return;

    const templateProps = getAnnotationTemplateProps(template);
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);

    const updates = {
      id: selectedAnnotation.id,
      ...templateProps,
      annotationTemplateId: template.id,
      templateLabel: template.label,
      listingId: template.listingId,
    };
    if (resolvedType) updates.type = resolvedType;

    await updateAnnotation(updates);
    handleTemplateDropdownClose();
  }

  function handleCloneClick(event) {
    setCloneAnchorEl(event.currentTarget);
  }

  function handleCloneClose() {
    setCloneAnchorEl(null);
  }

  async function handleCloneTemplateChange(annotationTemplateId) {
    const template = cloneCandidates?.find(
      (t) => t.id === annotationTemplateId
    );
    const newAnnotation = {
      ...getAnnotationTemplateProps(template),
      annotationTemplateId: template?.id,
      label: template?.label,
    };
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);
    if (resolvedType) newAnnotation.type = resolvedType;

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

  function handleOpenTemplateProperties() {
    if (!selectedAnnotation?.annotationTemplateId) return;
    dispatch(
      setSelectedItem({
        id: selectedAnnotation.annotationTemplateId,
        type: "ANNOTATION_TEMPLATE",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  async function handleHeightChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      height: updatedAnnotation.height,
    });
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
        {/* Row 1 - Template selector (draggable) */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <GripIcon fontSize="small" sx={{ color: "text.disabled", flexShrink: 0 }} />

          <AnnotationTemplateIcon template={selectedAnnotation || {}} size={16} />

          <Typography
            variant="body2"
            sx={{
              flex: 1,
              fontWeight: 600,
              fontSize: "0.8rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {label}
          </Typography>

          <Tooltip title="Changer le modèle">
            <IconButton
              size="small"
              onClick={handleTemplateDropdownClick}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <ArrowDropDownIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Propriétés du modèle">
            <IconButton
              size="small"
              onClick={handleOpenTemplateProperties}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                "&:hover": { bgcolor: "action.hover", color: "text.primary" },
              }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Row 2 - Height field + measurements */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.25,
            py: 0.25,
            gap: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <FieldAnnotationHeight
            annotation={selectedAnnotation}
            onChange={handleHeightChange}
          />
          <Box sx={{ flex: 1 }} />
          <AnnotationMeasurements annotation={selectedAnnotation} />
        </Box>

        {/* Row 3 - Actions row */}
        <ToolbarAnnotationActions
          accentColor={accentColor}
          onClone={handleCloneClick}
          onResize={handleResizeClick}
          resizeActive={wrapperMode}
          onDelete={handleDeleteClick}
          extraActions={
            <>
              {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
                <IconButtonAnchorAnnotation annotation={selectedAnnotation} accentColor={accentColor} />
              )}
              {selectedAnnotation?.type === "STRIP" && (
                <IconButtonFlipStripAnnotation annotation={selectedAnnotation} accentColor={accentColor} />
              )}
            </>
          }
          layerChip={
            selectedAnnotation && !selectedAnnotation.isBaseMapAnnotation ? (
              <ChipLayerSelector
                annotationIds={[selectedAnnotation.id]}
                annotations={[selectedAnnotation]}
                baseMapId={selectedAnnotation.baseMapId}
              />
            ) : null
          }
        />

        {/* Template selector menu (same type) */}
        <Menu
          open={Boolean(templateAnchorEl)}
          anchorEl={templateAnchorEl}
          onClose={handleTemplateDropdownClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={selectedAnnotation?.annotationTemplateId}
            onChange={handleTemplateChange}
            annotationTemplates={sameTypeCandidates}
            listings={sameTypeListings}
          />
        </Menu>

        {/* Clone template selector menu (compatible types) */}
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
            annotationTemplates={cloneCandidates}
            listings={cloneListings}
          />
        </Menu>
      </Paper>
    </Box>
  );
}
