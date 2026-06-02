import { useEffect, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import db from "App/db/db";

import {
  setCanTransformNode,
  setWrapperMode,
} from "Features/mapEditor/mapEditorSlice";
import {
  clearSelection,
  clearSelectedPartIds,
  clearSelectedPointIds,
  setSelectedItem,
  setSelectedPartIds,
  setSelectedPointIds,
  setSubSelection,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "../hooks/useSelectedAnnotationPart";
import useDeleteAnnotation from "../hooks/useDeleteAnnotation";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useHasThreedViewerPeer from "Features/threedEditor/hooks/useHasThreedViewerPeer";
import useNavigateThreedCameraToAnnotation from "Features/threedEditor/hooks/useNavigateThreedCameraToAnnotation";

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
  ThreeDRotation as ThreeDRotationIcon,
  SettingsOutlined as SettingsIcon,
  BugReport as BugReportIcon,
  RestartAlt as ResetIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import ToolbarPartGroupRow from "./ToolbarPartGroupRow";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationThickness from "./FieldAnnotationThickness";
import Shape3DSelector from "./Shape3DSelector";
import IconButtonFlipStripAnnotation from "./IconButtonFlipStripAnnotation";
import IconButtonToggleStripType from "./IconButtonToggleStripType";
import IconButtonDetectSimilarStrips from "./IconButtonDetectSimilarStrips";
import IconButtonAnchorAnnotation from "./IconButtonAnchorAnnotation";
import IconButtonDilateAnnotation from "./IconButtonDilateAnnotation";
import IconButtonRepairAnnotation from "./IconButtonRepairAnnotation";
import IconButtonSplitInSegments from "./IconButtonSplitInSegments";
import IconButtonConvertAnnotation from "./IconButtonConvertAnnotation";
import IconButtonVectorisation from "./IconButtonVectorisation";
import IconButtonSimplifyAnnotation from "./IconButtonSimplifyAnnotation";
import IconButtonCloseWallFootprint from "./IconButtonCloseWallFootprint";
import IconButtonSlopeWalls from "./IconButtonSlopeWalls";
import IconButtonContours from "./IconButtonContours";
import IconButtonCloseEnvelope from "./IconButtonCloseEnvelope";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import getAnnotationColor from "../utils/getAnnotationColor";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import {
  resolveDrawingShape,
  resolveDrawingShapeFromType,
  getAnnotationType,
} from "../constants/drawingShapeConfig";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";

export default function ToolbarEditAnnotation({ onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const part = useSelectedAnnotationPart();
  const hasPart = part && part.kind && part.kind !== "NONE";
  const deleteAnnotation = useDeleteAnnotation();
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
  const updateAnnotation = useUpdateAnnotation();
  const hasThreedPeer = useHasThreedViewerPeer();
  const navigateThreedCamera = useNavigateThreedCameraToAnnotation();

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
  const [selectedCloneType, setSelectedCloneType] = useState(
    selectedAnnotation?.type
  );

  // helpers

  const cloneTypeOptions = getCloneTypeOptions(selectedAnnotation?.type, part);
  const isMixedPart = hasPart && part.kind === "MIXED";
  const segmentsHasChains =
    hasPart &&
    part.kind === "SEGMENTS" &&
    Array.isArray(part.chains) &&
    part.chains.length > 0;
  const cloneDisabled =
    isMixedPart ||
    (hasPart &&
      !isMixedPart &&
      part.kind !== "SEGMENTS" &&
      (!part.pointRefs || part.pointRefs.length < 2)) ||
    (hasPart && part.kind === "SEGMENTS" && !segmentsHasChains);

  // Filter clone candidates based on selected clone type
  const filteredCloneCandidates = (() => {
    if (!cloneCandidates || !selectedCloneType) return cloneCandidates;
    // STRIP shows all compatible templates (polyline + polygon)
    if (selectedCloneType === "STRIP") return cloneCandidates;
    const targetDrawingShape = resolveDrawingShapeFromType(selectedCloneType);
    if (!targetDrawingShape) return cloneCandidates;
    return cloneCandidates.filter(
      (t) => resolveDrawingShape(t) === targetDrawingShape
    );
  })();

  const accentColor = getAnnotationColor(selectedAnnotation) || "#6366F1";

  // Template-locked fields (overrideFields): editing them is a no-op since the
  // template value wins on the next read, so we gray them out.
  const overrideFields =
    selectedAnnotation?.annotationTemplateProps?.overrideFields;
  const isLocked = (f) =>
    Array.isArray(overrideFields) && overrideFields.includes(f);
  const isPolylineOrStrip = ["POLYLINE", "STRIP"].includes(
    selectedAnnotation?.type
  );
  const isClosedShape =
    selectedAnnotation?.type === "POLYGON" ||
    (selectedAnnotation?.type === "POLYLINE" && selectedAnnotation?.closeLine);

  // True iff any vertex on the contour, any cut, or any innerPoint carries
  // a non-zero offsetBottom / offsetTop — i.e. the annotation has per-vertex
  // 3D custom offsets that the user can reset.
  const hasCustomOffsets = useMemo(() => {
    if (!selectedAnnotation) return false;
    const ringHas = (ring) =>
      (ring || []).some(
        (p) => (p?.offsetBottom ?? 0) !== 0 || (p?.offsetTop ?? 0) !== 0
      );
    if (ringHas(selectedAnnotation.points)) return true;
    if (Array.isArray(selectedAnnotation.cuts)) {
      for (const c of selectedAnnotation.cuts) {
        if (ringHas(c?.points)) return true;
      }
    }
    if (ringHas(selectedAnnotation.innerPoints)) return true;
    return false;
  }, [selectedAnnotation]);
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
    if (cloneDisabled) return;
    const defaultCloneType = hasPart
      ? part.targetAnnotationType || cloneTypeOptions?.[0]?.key
      : selectedAnnotation?.type;
    setSelectedCloneType(defaultCloneType);
    setCloneAnchorEl(event.currentTarget);
  }

  function handleClearSubSelection() {
    dispatch(setSubSelection({ partId: null, partType: null, pointId: null }));
    dispatch(clearSelectedPartIds());
    dispatch(clearSelectedPointIds());
  }

  function handleRemoveGroup(group) {
    if (group.kind === "POINTS") {
      dispatch(clearSelectedPointIds());
      return;
    }
    if (group.kind === "SEGMENTS") {
      // Keep entries that are NOT segments / cut-segments
      const toRemove = new Set(group.items.map((i) => i.id));
      const next = (part?.partIds || []).filter((id) => !toRemove.has(id));
      dispatch(setSelectedPartIds(next));
      return;
    }
    if (group.kind === "CUTS") {
      const toRemove = new Set(group.items.map((i) => i.id));
      const next = (part?.partIds || []).filter((id) => !toRemove.has(id));
      dispatch(setSelectedPartIds(next));
      return;
    }
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

    // Override type if user selected a different one
    if (selectedCloneType) newAnnotation.type = selectedCloneType;

    await cloneAnnotationAndEntity(selectedAnnotation, {
      newAnnotation,
      part: hasPart ? part : undefined,
    });
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

  async function handleEdgeHeightChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      edgeHeight: updatedAnnotation.edgeHeight,
    });
  }

  async function handleOffsetZChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      offsetZ: updatedAnnotation.offsetZ,
    });
  }

  async function handleStrokeWidthChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      strokeWidth: updatedAnnotation.strokeWidth,
      strokeWidthUnit: updatedAnnotation.strokeWidthUnit,
    });
  }

  async function handleResetCustomOffsets() {
    if (!selectedAnnotation?.id) return;
    // Read the raw annotation: selectedAnnotation.points has been resolved
    // to pixel-space x/y, so we can't write it back without corrupting
    // geometry. The DB record carries the original normalized refs with the
    // inline offsetTop/offsetBottom we want to strip.
    const raw = await db.annotations.get(selectedAnnotation.id);
    if (!raw) return;

    const stripOffsets = (ring) =>
      (ring || []).map((ref) => {
        if (!ref) return ref;
        const { offsetTop, offsetBottom, ...rest } = ref;
        return rest;
      });

    const updates = { id: raw.id };
    if (Array.isArray(raw.points)) {
      updates.points = stripOffsets(raw.points);
    }
    if (Array.isArray(raw.cuts)) {
      updates.cuts = raw.cuts.map((c) => ({
        ...c,
        points: stripOffsets(c?.points),
      }));
    }
    if (Array.isArray(raw.innerPoints)) {
      updates.innerPoints = stripOffsets(raw.innerPoints);
    }

    await updateAnnotation(updates);
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
          <GripIcon
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
          />

          {isMixedPart ? (
            <>
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: 600,
                  fontSize: "0.8rem",
                }}
              >
                Multi-sélection
              </Typography>
              <Tooltip title="Revenir à l'annotation entière">
                <IconButton
                  size="small"
                  onClick={handleClearSubSelection}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{
                    flexShrink: 0,
                    color: "text.disabled",
                    "&:hover": {
                      bgcolor: "action.hover",
                      color: "text.primary",
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : hasPart ? (
            <>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.7rem",
                  flexShrink: 0,
                }}
              >
                {part.captionFr}
              </Typography>
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
                  color: "text.primary",
                }}
              >
                {part.label}
              </Typography>
              <Tooltip title="Revenir à l'annotation entière">
                <IconButton
                  size="small"
                  onClick={handleClearSubSelection}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{
                    flexShrink: 0,
                    color: "text.disabled",
                    "&:hover": {
                      bgcolor: "action.hover",
                      color: "text.primary",
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <AnnotationTemplateIcon
                template={
                  selectedAnnotation?.annotationTemplate ||
                  selectedAnnotation ||
                  {}
                }
                size={16}
              />

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
                    "&:hover": {
                      bgcolor: "action.hover",
                      color: "text.primary",
                    },
                  }}
                >
                  <ArrowDropDownIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Copy annotation data">
                <IconButton
                  size="small"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (selectedAnnotation) {
                      const data = JSON.stringify(selectedAnnotation, null, 2);
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

              {hasThreedPeer && (
                <Tooltip title="Centrer la vue 3D sur l'annotation">
                  <IconButton
                    size="small"
                    onClick={() => navigateThreedCamera(selectedAnnotation)}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{
                      flexShrink: 0,
                      color: "text.disabled",
                      "&:hover": {
                        bgcolor: "action.hover",
                        color: "text.primary",
                      },
                    }}
                  >
                    <ThreeDRotationIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Propriétés du modèle">
                <IconButton
                  size="small"
                  onClick={handleOpenTemplateProperties}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{
                    flexShrink: 0,
                    color: "text.disabled",
                    "&:hover": {
                      bgcolor: "action.hover",
                      color: "text.primary",
                    },
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        {/* Group rows — only in MIXED mode (1 row per kind with key qty + remove) */}
        {isMixedPart && (
          <Box
            sx={{ py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            {part.groups.map((group) => (
              <ToolbarPartGroupRow
                key={group.kind}
                group={group}
                onRemove={() => handleRemoveGroup(group)}
              />
            ))}
          </Box>
        )}

        {/* Row 2 - 3D geometry props (height + offsetZ) — hidden when a part is selected */}
        {!hasPart && (
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
            {selectedAnnotation?.shape3D?.key !== "REVOLUTION" &&
              selectedAnnotation?.shape3D?.key !== "EXTRUSION_PROFILE" && (
                <FieldAnnotationHeight
                  annotation={selectedAnnotation}
                  onChange={handleHeightChange}
                  disabled={isLocked("height")}
                />
              )}
            {selectedAnnotation?.type === "POLYGON" && (
              <FieldAnnotationHeight
                annotation={selectedAnnotation}
                onChange={handleEdgeHeightChange}
                field="edgeHeight"
                label="ht. côté"
                disabled={isLocked("edgeHeight")}
              />
            )}
            <FieldAnnotationHeight
              annotation={selectedAnnotation}
              onChange={handleOffsetZChange}
              field="offsetZ"
              label="Offset"
              disabled={isLocked("offsetZ")}
            />
            {isPolylineOrStrip && (
              <FieldAnnotationThickness
                annotation={selectedAnnotation}
                onChange={handleStrokeWidthChange}
                disabled={isLocked("strokeWidth")}
              />
            )}
            <Box sx={{ flex: 1 }} />
            <Shape3DSelector annotation={selectedAnnotation} />
          </Box>
        )}

        {/* Row 2b - 3D custom offsets indicator + reset (only when present) */}
        {!hasPart && hasCustomOffsets && (
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
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontStyle: "italic" }}
            >
              3D custom
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Réinitialiser les offsets 3D personnalisés">
              <IconButton
                size="small"
                onClick={handleResetCustomOffsets}
                sx={{
                  color: "text.disabled",
                  "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                }}
              >
                <ResetIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Row 3 - Measurements (right-aligned) — hidden in MIXED, group rows carry per-kind qties */}
        {!isMixedPart && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              px: 1.25,
              py: 0.25,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <AnnotationMeasurements
              annotation={selectedAnnotation}
              part={part}
            />
          </Box>
        )}

        {/* Row 4 - Actions row */}
        <ToolbarAnnotationActions
          accentColor={accentColor}
          onClone={handleCloneClick}
          cloneDisabled={cloneDisabled}
          cloneTooltip={
            hasPart && part.kind === "MIXED"
              ? "Sélectionnez une seule catégorie (segments, ouverture ou guide) pour dupliquer"
              : hasPart && part.kind === "SEGMENTS" && part.chains?.length > 1
                ? `Dupliquer (${part.chains.length} polylines créées)`
                : undefined
          }
          hideClone={hasPart && part.kind === "POINT"}
          onResize={handleResizeClick}
          resizeActive={wrapperMode}
          hideResize={hasPart}
          onDelete={handleDeleteClick}
          hideDelete={hasPart}
          extraActions={
            hasPart ? null : (
              <>
                {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
                  <IconButtonAnchorAnnotation
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) &&
                  !selectedAnnotation?.closeLine && (
                    <IconButtonToggleStripType
                      annotation={selectedAnnotation}
                      accentColor={accentColor}
                    />
                  )}
                {selectedAnnotation?.type === "STRIP" && (
                  <IconButtonFlipStripAnnotation
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {selectedAnnotation?.type === "STRIP" && (
                  <IconButtonDetectSimilarStrips
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {isClosedShape && (
                  <IconButtonDilateAnnotation
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {["POLYLINE", "POLYGON", "STRIP"].includes(
                  selectedAnnotation?.type
                ) && (
                  <IconButtonRepairAnnotation
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {["POLYLINE", "POLYGON", "STRIP"].includes(
                  selectedAnnotation?.type
                ) && (
                  <IconButtonSplitInSegments
                    annotations={[selectedAnnotation]}
                    accentColor={accentColor}
                  />
                )}
                {selectedAnnotation?.type === "POLYGON" && (
                  <IconButtonConvertAnnotation
                    annotations={[selectedAnnotation]}
                    accentColor={accentColor}
                  />
                )}
                {selectedAnnotation?.type === "POLYGON" && (
                  <IconButtonVectorisation
                    annotations={[selectedAnnotation]}
                    accentColor={accentColor}
                  />
                )}
                {selectedAnnotation?.type === "POLYGON" && (
                  <IconButtonCloseWallFootprint
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {selectedAnnotation?.type === "POLYGON" &&
                  selectedAnnotation?.guideLines?.some(
                    (g) => g?.points?.length >= 2 && g?.slopePct
                  ) && (
                    <IconButtonSlopeWalls
                      annotation={selectedAnnotation}
                      accentColor={accentColor}
                    />
                  )}
                {["POLYLINE", "POLYGON", "STRIP"].includes(
                  selectedAnnotation?.type
                ) && (
                  <IconButtonSimplifyAnnotation
                    annotation={selectedAnnotation}
                    accentColor={accentColor}
                  />
                )}
                {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
                  <IconButtonContours
                    annotations={[selectedAnnotation]}
                    accentColor={accentColor}
                  />
                )}
                {["POLYLINE", "STRIP"].includes(selectedAnnotation?.type) && (
                  <IconButtonCloseEnvelope
                    annotations={[selectedAnnotation]}
                    accentColor={accentColor}
                  />
                )}
              </>
            )
          }
          layerChip={
            !hasPart &&
            selectedAnnotation &&
            !selectedAnnotation.isBaseMapAnnotation ? (
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
            selectedAnnotationTemplateId={
              selectedAnnotation?.annotationTemplateId
            }
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
          {cloneTypeOptions && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Type de l'annotation dupliquée
              </Typography>
              <ToggleSingleSelectorGeneric
                selectedKey={selectedCloneType}
                options={cloneTypeOptions}
                onChange={(v) =>
                  setSelectedCloneType(v ?? selectedAnnotation?.type)
                }
              />
            </Box>
          )}
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={
              selectedAnnotation?.annotationTemplateId
            }
            onChange={handleCloneTemplateChange}
            annotationTemplates={filteredCloneCandidates}
            listings={cloneListings}
          />
        </Menu>
      </Paper>
    </Box>
  );
}
