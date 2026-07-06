import { useEffect, useMemo, useState } from "react";

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

import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
} from "../constants/drawingShapeConfig";
import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import getAnnotationQties from "../utils/getAnnotationQties";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "../utils/getAnnotationPropsFromAnnotationTemplateProps";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";

import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
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
  VerticalAlignTop as TopIcon,
  VerticalAlignBottom as BottomIcon,
} from "@mui/icons-material";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationIsExtSwitch from "./FieldAnnotationIsExtSwitch";
import Shape3DBatchSelector from "./Shape3DBatchSelector";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import IconButtonReentrantAngles from "./IconButtonReentrantAngles";
import IconButtonSettingOut from "./IconButtonSettingOut";
import IconButtonSplitInSegments from "./IconButtonSplitInSegments";
import IconButtonCleanSegments from "./IconButtonCleanSegments";
import IconButtonCurvature from "./IconButtonCurvature";
import IconButtonConvertAnnotation from "./IconButtonConvertAnnotation";
import IconButtonVectorisation from "./IconButtonVectorisation";
import IconButtonContours from "./IconButtonContours";
import IconButtonCloseEnvelope from "./IconButtonCloseEnvelope";
import IconButtonDilateAnnotation from "./IconButtonDilateAnnotation";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "./DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function ToolbarEditAnnotations({
  allAnnotations,
  onDragStart,
}) {
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
    useAnnotationTemplateCandidates(firstAnnotation, { variant: "sameType" }) ??
    {};
  const updateAnnotations = useUpdateAnnotations();

  // state

  const [openDatagrid, setOpenDatagrid] = useState(false);
  const [cloneAnchorEl, setCloneAnchorEl] = useState(null);
  const [selectedCloneType, setSelectedCloneType] = useState(null);
  const [stripElevation, setStripElevation] = useState("TOP");
  const [keepOriginalPoints, setKeepOriginalPoints] = useState(false);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
  const [pendingHeight, setPendingHeight] = useState(null);
  const [pendingIsExt, setPendingIsExt] = useState(null);

  // helpers - selected annotations

  const annotations = allAnnotations.filter((a) =>
    selectedItems.some((item) => item.nodeId === a.id)
  );

  const count = annotations.length;
  const countLabel = `${count} annotation${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;

  // helpers - batch height

  // Distinct heights among the current selection (undefined treated as a value)
  const heightValues = [...new Set(annotations.map((a) => a.height))];
  const heightsAreUniform = heightValues.length === 1;
  const heightDisplayValue = heightsAreUniform
    ? (heightValues[0] ?? "")
    : "Hauteurs variables";

  // Stable signature so the field remounts (resets its internal localValue)
  // when the selection changes.
  const selectionKey = annotations
    .map((a) => a.id)
    .sort()
    .join(",");

  // Only a finite number is a committable height.
  const canApplyHeight =
    typeof pendingHeight === "number" && Number.isFinite(pendingHeight);

  const hasStrips = annotations.some((a) => a.type === "STRIP");

  const hasPolylines = annotations.some((a) => a.type === "POLYLINE");

  const hasPolylinesAndPolygons =
    annotations.some((a) => a.type === "POLYLINE") &&
    annotations.some((a) => a.type === "POLYGON");

  const hasPolylinesOrPolygons = annotations.some(
    (a) => a.type === "POLYLINE" || a.type === "POLYGON"
  );

  // Tools shared by open lines and bands (cut, contours, close-envelope).
  const hasPolylinesOrStrips = annotations.some(
    (a) => a.type === "POLYLINE" || a.type === "STRIP"
  );

  // Batch isExt (exterior-side flag) only targets polylines / strips;
  // the switch shows ON when ALL targets are flagged. Toggling only stages
  // the value (pendingIsExt); "Appliquer" persists it.
  const isExtTargets = annotations.filter(
    (a) =>
      a.type === "POLYLINE" || a.type === "STRIP" || a.type === "POLYGON"
  );
  const allTargetsAreExt =
    isExtTargets.length > 0 && isExtTargets.every((a) => a.isExt);
  const canApplyIsExt =
    typeof pendingIsExt === "boolean" && pendingIsExt !== allTargetsAreExt;
  const canApplyBatch = canApplyHeight || canApplyIsExt;

  const hasPolygons = annotations.some((a) => a.type === "POLYGON");

  // Closed shapes can be dilated/contracted (same rule as the single-edit toolbar).
  const closedShapeAnnotations = annotations.filter(
    (a) => a.type === "POLYGON" || (a.type === "POLYLINE" && a.closeLine)
  );

  // The "Clean segments" action accepts any POLYLINE selection (>=2 pts):
  // multi-point polylines are split into 2-pt segments by the hook before
  // cleaning. We only require at least 2 annotations (otherwise nothing to
  // clean) AND that they are all POLYLINEs.
  const allArePolylines =
    annotations.length >= 2 &&
    annotations.every((a) => a.type === "POLYLINE" && a.points?.length >= 2);

  // "Aligner" (clean segments) also accepts bands: strips are aligned on their
  // centerline, then re-derived as strips. Allows mixed strip + polyline.
  const allAreAlignable =
    annotations.length >= 2 &&
    annotations.every(
      (a) => ["POLYLINE", "STRIP"].includes(a.type) && a.points?.length >= 2
    );

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
          totalSurface: qties?.enabled ? qties.surface || 0 : 0,
          totalLength: qties?.enabled ? qties.length || 0 : 0,
          hasSurface: ["RECTANGLE", "POLYGON", "STRIP"].includes(
            annotation.type
          ),
        });
      }
    }

    return Array.from(groups.values());
  }, [annotations, baseMap?.meterByPx]);

  // handlers

  // Reset the pending values whenever the selection changes
  useEffect(() => {
    setPendingHeight(null);
    setPendingIsExt(null);
  }, [selectionKey]);

  // Field onChange only stores the pending value; it does NOT persist.
  function handleBatchHeightFieldChange(updated) {
    setPendingHeight(updated?.height);
  }

  async function handleApplyBatch() {
    if (!canApplyBatch || annotations.length === 0) return;
    // Merge height (all annotations) and isExt (polylines / strips only)
    // into a single update per annotation.
    const updatesById = new Map();
    if (canApplyHeight) {
      for (const a of annotations) {
        updatesById.set(a.id, { id: a.id, height: pendingHeight });
      }
    }
    if (canApplyIsExt) {
      for (const a of isExtTargets) {
        const update = updatesById.get(a.id) ?? { id: a.id };
        update.isExt = pendingIsExt;
        updatesById.set(a.id, update);
      }
    }
    await updateAnnotations([...updatesById.values()]);
    setPendingHeight(null);
    setPendingIsExt(null);
  }

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

  const showStripElevation =
    selectedCloneType === "STRIP" && firstAnnotation?.type === "POLYLINE";

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

    await cloneAnnotationsAndEntities(annotations, {
      newAnnotation,
      ...(showStripElevation ? { stripElevation } : {}),
      keepOriginalPoints,
    });
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

    const updates = annotations.map((annotation) => {
      // Only overwrite properties the template locks (overrideFields);
      // non-overridden fields keep the annotation's own value.
      const merged = getAnnotationPropsFromAnnotationTemplateProps(
        annotation,
        templateProps,
        baseMap
      );
      // annotationTemplateProps is a render-time snapshot (useAnnotationsV2
      // recomputes it); don't persist it to the DB record.
      delete merged.annotationTemplateProps;
      return {
        ...merged,
        id: annotation.id,
        annotationTemplateId: template.id,
        templateLabel: template.label,
        listingId: template.listingId,
        // Persist the NEW template's lock set so the editor UI reflects it.
        overrideFields: templateProps.overrideFields,
        ...(resolvedType ? { type: resolvedType } : {}),
      };
    });
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
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
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
            <GripIcon
              fontSize="small"
              sx={{ color: "text.disabled", flexShrink: 0 }}
            />
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
                  // imageSize + meterByPx make the export self-contained for
                  // the AI meshing prompt (docs/annotations/MESH_IMPORT_PROMPT.md)
                  const data = stringifyAnnotationData({
                    imageSize: baseMap?.getImageSize?.() ?? null,
                    meterByPx:
                      baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx ?? null,
                    annotations,
                  });
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

        {/* Batch height */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 1.25,
            py: 0.75,
          }}
        >
          <FieldAnnotationHeight
            key={selectionKey}
            annotation={{ id: "batch-height", height: heightDisplayValue }}
            onChange={handleBatchHeightFieldChange}
          />
          {isExtTargets.length > 0 && (
            <FieldAnnotationIsExtSwitch
              checked={pendingIsExt ?? allTargetsAreExt}
              onChange={setPendingIsExt}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            disabled={!canApplyBatch}
            onClick={handleApplyBatch}
            sx={{ flexShrink: 0 }}
          >
            Appliquer
          </Button>
        </Box>

        {/* Batch 3D shape (e.g. revolution from a shared axis) */}
        <Shape3DBatchSelector annotations={annotations} />

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
              {hasPolylinesAndPolygons && (
                <IconButtonReentrantAngles
                  annotations={annotations}
                  accentColor="#6366F1"
                />
              )}
              {hasPolylines && (
                <IconButtonSettingOut
                  annotations={annotations.filter((a) => a.type === "POLYLINE")}
                  accentColor="#6366F1"
                />
              )}
              {(hasPolylinesOrPolygons || hasStrips) && (
                <IconButtonSplitInSegments
                  annotations={annotations.filter((a) =>
                    ["POLYLINE", "POLYGON", "STRIP"].includes(a.type)
                  )}
                  accentColor="#6366F1"
                />
              )}
              {allAreAlignable && (
                <IconButtonCleanSegments
                  annotations={annotations}
                  accentColor="#6366F1"
                />
              )}
              {allArePolylines && (
                <IconButtonCurvature
                  annotations={annotations}
                  accentColor="#6366F1"
                />
              )}
              {hasPolygons && (
                <IconButtonConvertAnnotation
                  annotations={annotations.filter((a) => a.type === "POLYGON")}
                  accentColor="#6366F1"
                />
              )}
              {hasPolygons && (
                <IconButtonVectorisation
                  annotations={annotations.filter((a) => a.type === "POLYGON")}
                  accentColor="#6366F1"
                />
              )}
              {hasPolylinesOrStrips && (
                <IconButtonContours
                  annotations={annotations.filter((a) =>
                    ["POLYLINE", "STRIP"].includes(a.type)
                  )}
                  accentColor="#6366F1"
                />
              )}
              {hasPolylinesOrStrips && (
                <IconButtonCloseEnvelope
                  annotations={annotations.filter((a) =>
                    ["POLYLINE", "STRIP"].includes(a.type)
                  )}
                  accentColor="#6366F1"
                />
              )}
              {closedShapeAnnotations.length > 0 && (
                <IconButtonDilateAnnotation
                  annotations={closedShapeAnnotations}
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
                onChange={(v) =>
                  setSelectedCloneType(v ?? firstAnnotation?.type)
                }
              />
            </Box>
          )}
          {showStripElevation && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Position de la bande
              </Typography>
              <ToggleSingleSelectorGeneric
                selectedKey={stripElevation}
                options={[
                  { key: "TOP", label: "Haut", icon: <TopIcon /> },
                  { key: "BOTTOM", label: "Bas", icon: <BottomIcon /> },
                ]}
                onChange={(v) => setStripElevation(v ?? "TOP")}
              />
            </Box>
          )}
          <Box sx={{ px: 2, py: 0.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={keepOriginalPoints}
                  onChange={(e) => setKeepOriginalPoints(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  Conserver les points d'origine
                </Typography>
              }
            />
          </Box>
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
          <DatagridAnnotations
            annotations={annotations}
            onClose={() => setOpenDatagrid(false)}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}

// --- Template group row within multi-selection toolbar ---

function TemplateGroupRow({ group, onRemove }) {
  // helpers

  const { annotation, count, totalSurface, totalLength, hasSurface } = group;
  const label =
    annotation?.annotationTemplateProps?.label || annotation?.label || "-";
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
              sx={{
                fontSize: "0.8rem",
                fontWeight: 400,
                color: "text.secondary",
              }}
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
