import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedItems,
  removeSelectedItem,
  clearSelection,
} from "Features/selection/selectionSlice";

import { setWrapperMode } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotations from "../hooks/useDeleteAnnotations";
import useUpdateAnnotations from "../hooks/useUpdateAnnotations";
import useMergeAnnotations from "../hooks/useMergeAnnotations";
import useCloneAnnotationsAndEntities from "Features/mapEditor/hooks/useCloneAnnotationsAndEntities";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { resolveDrawingShape, resolveDrawingShapeFromType, getAnnotationType } from "../constants/drawingShapeConfig";
import getAnnotationQties from "../utils/getAnnotationQties";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";

import {
  Box,
  Divider,
  IconButton,
  Menu,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  Close as RemoveIcon,
  TableChart as TableChartIcon,
  BugReport as BugReportIcon,
  CallMerge as MergeIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import IconButtonExtractStripBoundaries from "./IconButtonExtractStripBoundaries";
import IconButtonReentrantAngles from "./IconButtonReentrantAngles";
import IconButtonSplitInSegments from "./IconButtonSplitInSegments";
import IconButtonConvertAnnotation from "./IconButtonConvertAnnotation";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "./DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function ToolbarEditAnnotations({ allAnnotations, onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const wrapperMode = useSelector((s) => s.mapEditor.wrapperMode);
  const deleteAnnotations = useDeleteAnnotations();
  const mergeAnnotations = useMergeAnnotations();
  const cloneAnnotationsAndEntities = useCloneAnnotationsAndEntities();
  const baseMap = useMainBaseMap();

  // Template candidates based on first selected annotation
  const firstAnnotation = allAnnotations.find((a) =>
    selectedItems.some((item) => item.nodeId === a.id)
  );
  const { candidates: cloneCandidates, listings: cloneListings } =
    useAnnotationTemplateCandidates(firstAnnotation) ?? {};
  const { candidates: sameTypeCandidates, listings: sameTypeListings } =
    useAnnotationTemplateCandidates(firstAnnotation, { variant: "sameType" }) ?? {};
  const updateAnnotations = useUpdateAnnotations();

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);
  const [cloneAnchorEl, setCloneAnchorEl] = useState(null);
  const [selectedCloneType, setSelectedCloneType] = useState(null);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);

  // helpers - selected annotations

  const annotations = allAnnotations.filter((a) =>
    selectedItems.some((item) => item.nodeId === a.id)
  );

  const count = annotations.length;
  const countLabel = `${count} annotation${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;

  const hasStrips = annotations.some((a) => a.type === "STRIP");
  const showExtractBoundaries = hasStrips;

  const hasPolylinesAndPolygons =
    annotations.some((a) => a.type === "POLYLINE") &&
    annotations.some((a) => a.type === "POLYGON");

  const hasPolylinesOrPolygons = annotations.some(
    (a) => a.type === "POLYLINE" || a.type === "POLYGON"
  );

  const hasPolygons = annotations.some((a) => a.type === "POLYGON");

  // helpers - can merge

  const canMerge = useMemo(() => {
    if (annotations.length < 2) return null;
    const templateIds = new Set(
      annotations.map((a) => a.annotationTemplateId).filter(Boolean)
    );
    if (templateIds.size !== 1) return null;
    const shapes = new Set(
      annotations.map((a) => resolveDrawingShapeFromType(a.type))
    );
    if (shapes.size !== 1) return null;
    const shape = [...shapes][0];
    if (shape !== "POLYLINE" && shape !== "POLYGON") return null;
    return { shape, annotations };
  }, [annotations]);

  // helpers - group by annotationTemplateId with aggregated quantities

  const templateGroups = useMemo(() => {
    const groups = new Map();
    const meterByPx = baseMap?.meterByPx;

    for (const annotation of annotations) {
      const key = annotation.annotationTemplateId || annotation.id;
      const existing = groups.get(key);

      const qties = getAnnotationQties({ annotation, meterByPx });

      if (existing) {
        existing.annotationIds.push(annotation.id);
        existing.count += 1;
        if (qties?.enabled) {
          existing.totalSurface += qties.surface || 0;
          existing.totalLength += qties.length || 0;
        }
      } else {
        groups.set(key, {
          templateId: key,
          annotation,
          annotationIds: [annotation.id],
          count: 1,
          totalSurface: qties?.enabled ? (qties.surface || 0) : 0,
          totalLength: qties?.enabled ? (qties.length || 0) : 0,
          hasSurface: ["RECTANGLE", "POLYGON", "STRIP"].includes(annotation.type),
        });
      }
    }

    return Array.from(groups.values());
  }, [annotations, baseMap?.meterByPx]);

  // handlers

  function handleRemoveTemplateFromSelection(annotationIds) {
    for (const annotationId of annotationIds) {
      const item = selectedItems.find((i) => i.nodeId === annotationId);
      if (item) {
        dispatch(removeSelectedItem(item.id));
      }
    }
  }

  // helpers - clone

  const cloneTypeOptions = getCloneTypeOptions(firstAnnotation?.type);

  const filteredCloneCandidates = (() => {
    if (!cloneCandidates || !selectedCloneType) return cloneCandidates;
    if (selectedCloneType === "STRIP") return cloneCandidates;
    const targetDrawingShape = resolveDrawingShapeFromType(selectedCloneType);
    if (!targetDrawingShape) return cloneCandidates;
    return cloneCandidates.filter(
      (t) => resolveDrawingShape(t) === targetDrawingShape
    );
  })();

  function handleCloneClick(event) {
    setSelectedCloneType(firstAnnotation?.type);
    setCloneAnchorEl(event.currentTarget);
  }

  function handleCloneClose() {
    setCloneAnchorEl(null);
  }

  async function handleCloneTemplateChange(annotationTemplateId) {
    const template = filteredCloneCandidates?.find(
      (t) => t.id === annotationTemplateId
    );
    const newAnnotation = {
      ...getAnnotationTemplateProps(template),
      annotationTemplateId: template?.id,
      label: template?.label,
      listingId: template?.listingId,
    };
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);
    if (resolvedType) newAnnotation.type = resolvedType;
    if (selectedCloneType) newAnnotation.type = selectedCloneType;

    await cloneAnnotationsAndEntities(annotations, { newAnnotation });
    handleCloneClose();
  }

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
    if (!template) return;

    const templateProps = getAnnotationTemplateProps(template);
    const resolvedShape = resolveDrawingShape(template);
    const resolvedType = getAnnotationType(resolvedShape);

    const updates = annotations.map((annotation) => ({
      id: annotation.id,
      ...templateProps,
      annotationTemplateId: template.id,
      templateLabel: template.label,
      listingId: template.listingId,
      ...(resolvedType ? { type: resolvedType } : {}),
    }));
    await updateAnnotations(updates);
    handleTemplateDropdownClose();
  }

  async function handleMergeClick() {
    if (!canMerge) return;
    await mergeAnnotations(canMerge.annotations, { shape: canMerge.shape });
    dispatch(clearSelection());
  }

  function handleResizeClick() {
    dispatch(setWrapperMode(!wrapperMode));
  }

  async function handleDeleteClick() {
    await deleteAnnotations(annotations.map((a) => a.id));
    dispatch(clearSelection());
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper
        elevation={6}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          minWidth: 250,
        }}
      >
        {/* Header - draggable */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GripIcon fontSize="small" sx={{ color: "text.disabled", flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: "0.8rem" }}
            >
              {countLabel}
            </Typography>
          </Box>
          <Tooltip title="Copy annotations data">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (annotations?.length > 0) {
                  const data = JSON.stringify(annotations, null, 2);
                  navigator.clipboard.writeText(data);
                }
              }}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                opacity: 0.4,
                "&:hover": { opacity: 1, bgcolor: "action.hover" },
              }}
            >
              <BugReportIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Voir les données">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setOpenDatagrid(true)}
              sx={{ flexShrink: 0 }}
            >
              <TableChartIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Template group rows */}
        <Box sx={{ py: 0.5 }}>
          {templateGroups.map((group) => (
            <TemplateGroupRow
              key={group.templateId}
              group={group}
              onRemove={() =>
                handleRemoveTemplateFromSelection(group.annotationIds)
              }
            />
          ))}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 1.25,
              py: 0.5,
            }}
          >
            <Tooltip title="Changer le modèle">
              <IconButton
                size="small"
                onClick={handleTemplateDropdownClick}
                sx={{
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  color: "text.secondary",
                  "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                }}
              >
                <ArrowDropDownIcon sx={{ fontSize: 18, mr: 0.25 }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  Changer le modèle
                </Typography>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Divider />

        {/* Actions row */}
        <ToolbarAnnotationActions
          accentColor="#6366F1"
          onClone={handleCloneClick}
          onResize={handleResizeClick}
          resizeActive={wrapperMode}
          onDelete={handleDeleteClick}
          extraActions={
            <>
              {canMerge && (
                <Tooltip title="Fusionner les annotations">
                  <IconButton
                    size="small"
                    onClick={handleMergeClick}
                    sx={{
                      color: "text.disabled",
                      "&:hover": {
                        color: "#6366F1",
                        bgcolor: "#6366F1" + "18",
                      },
                    }}
                  >
                    <MergeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {showExtractBoundaries && (
                <IconButtonExtractStripBoundaries
                  annotations={annotations}
                  accentColor="#6366F1"
                />
              )}
              {hasPolylinesAndPolygons && (
                <IconButtonReentrantAngles
                  annotations={annotations}
                  accentColor="#6366F1"
                />
              )}
              {hasPolylinesOrPolygons && (
                <IconButtonSplitInSegments
                  annotations={annotations.filter(
                    (a) => a.type === "POLYLINE" || a.type === "POLYGON"
                  )}
                  accentColor="#6366F1"
                />
              )}
              {hasPolygons && (
                <IconButtonConvertAnnotation
                  annotations={annotations.filter(
                    (a) => a.type === "POLYGON"
                  )}
                  accentColor="#6366F1"
                />
              )}
            </>
          }
          layerChip={
            annotations.length > 0 ? (
              <ChipLayerSelector
                annotationIds={annotations.map((a) => a.id)}
                annotations={annotations}
                baseMapId={baseMap?.id}
              />
            ) : null
          }
        />
        {/* Clone template selector menu */}
        <Menu
          open={Boolean(cloneAnchorEl)}
          anchorEl={cloneAnchorEl}
          onClose={handleCloneClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {cloneTypeOptions && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Type de l'annotation dupliquée
              </Typography>
              <ToggleSingleSelectorGeneric
                selectedKey={selectedCloneType}
                options={cloneTypeOptions}
                onChange={(v) => setSelectedCloneType(v ?? firstAnnotation?.type)}
              />
            </Box>
          )}
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={firstAnnotation?.annotationTemplateId}
            onChange={handleCloneTemplateChange}
            annotationTemplates={filteredCloneCandidates}
            listings={cloneListings}
          />
        </Menu>

        {/* Template change menu (same type) */}
        <Menu
          open={Boolean(templateAnchorEl)}
          anchorEl={templateAnchorEl}
          onClose={handleTemplateDropdownClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
        >
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={firstAnnotation?.annotationTemplateId}
            onChange={handleTemplateChange}
            annotationTemplates={sameTypeCandidates}
            listings={sameTypeListings}
          />
        </Menu>
      </Paper>

      <DialogGeneric
        title={countLabel}
        open={openDatagrid}
        onClose={() => setOpenDatagrid(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations annotations={annotations} onClose={() => setOpenDatagrid(false)} />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}

// --- Template group row within multi-selection toolbar ---

function TemplateGroupRow({ group, onRemove }) {
  // helpers

  const { annotation, count, totalSurface, totalLength, hasSurface } = group;
  const label = annotation?.annotationTemplateProps?.label || annotation?.label || "-";
  const countSuffix = count > 1 ? ` (×${count})` : "";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.75,
        "&:hover": { bgcolor: "action.hover" },
        transition: "background 0.1s",
      }}
    >
      <AnnotationTemplateIcon template={annotation || {}} size={16} />

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
          {countSuffix && (
            <Typography
              component="span"
              variant="body2"
              sx={{ fontSize: "0.8rem", fontWeight: 400, color: "text.secondary" }}
            >
              {countSuffix}
            </Typography>
          )}
        </Typography>
        <AnnotationMeasurements
          surface={hasSurface && totalSurface > 0 ? totalSurface : null}
          length={totalLength > 0 ? totalLength : null}
        />
      </Box>

      <Tooltip title="Retirer de la sélection">
        <IconButton
          size="small"
          onClick={onRemove}
          sx={{
            flexShrink: 0,
            color: "text.disabled",
            "&:hover": { color: "error.main", bgcolor: "error.lighter" },
          }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
