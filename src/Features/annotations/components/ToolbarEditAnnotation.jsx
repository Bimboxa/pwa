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

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useSelectedAnnotationPart from "../hooks/useSelectedAnnotationPart";
import useDeleteAnnotation from "../hooks/useDeleteAnnotation";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";
import useChangeAnnotationTemplate from "../hooks/useChangeAnnotationTemplate";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useHasThreedViewerPeer from "Features/threedEditor/hooks/useHasThreedViewerPeer";
import useNavigateThreedCameraToAnnotation from "Features/threedEditor/hooks/useNavigateThreedCameraToAnnotation";

import {
  Box,
  ButtonBase,
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
import ToolbarEditRevolutionAxis from "./ToolbarEditRevolutionAxis";
import ToolbarEditRevolutionAxisPlacement from "./ToolbarEditRevolutionAxisPlacement";
import ToolbarAnnotationActions from "./ToolbarAnnotationActions";
import ButtonCloneAnnotation from "./ButtonCloneAnnotation";
import EditAnnotationTools from "./EditAnnotationTools";
import RowProcedureActionAuto from "Features/annotationsAuto/components/RowProcedureActionAuto";
import ToolbarPartGroupRow from "./ToolbarPartGroupRow";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import ChipLayerSelector from "Features/layers/components/ChipLayerSelector";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationThickness from "./FieldAnnotationThickness";
import FieldAnnotationIsExtSwitch from "./FieldAnnotationIsExtSwitch";
import FieldAnnotationRevolutionSolidSwitch from "./FieldAnnotationRevolutionSolidSwitch";
import Shape3DSelector from "./Shape3DSelector";
import ToolbarEditForeignFootprint from "./ToolbarEditForeignFootprint";
import SectionZonesBandInToolbar from "Features/zonings/components/SectionZonesBandInToolbar";
import IconButtonArcifySelectedPoints from "./IconButtonArcifySelectedPoints";
import ToolbarEditGuideLine from "./ToolbarEditGuideLine";
import ToolbarEditIsoHeightLine from "./ToolbarEditIsoHeightLine";
import ToolbarEditProfileLine from "./ToolbarEditProfileLine";
import ToolbarEditMesh3dParts from "Features/annotationMesh3d/components/ToolbarEditMesh3dParts";
import useSelectedMesh3dParts from "Features/annotationMesh3d/hooks/useSelectedMesh3dParts";

import getAnnotationColor from "../utils/getAnnotationColor";
import getAnnotationHasOverlayActions from "../utils/getAnnotationHasOverlayActions";
import getCloneAnnotationPartState from "../utils/getCloneAnnotationPartState";

// `hasOverlayRow`: the host editor renders the quick-action row above the
// selected annotation (2D map editor — NodeSegmentLengthsStatic, 3D editor —
// ThreedAnnotationOverlayActions). Pass false in a host without that row: the
// toolbar is then the only place for these actions.
export default function ToolbarEditAnnotation({
  onDragStart,
  hasOverlayRow = true,
}) {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const part = useSelectedAnnotationPart();
  const hasPart = part && part.kind && part.kind !== "NONE";
  const mesh3dParts = useSelectedMesh3dParts();
  const deleteAnnotation = useDeleteAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const changeAnnotationTemplate = useChangeAnnotationTemplate();
  const hasThreedPeer = useHasThreedViewerPeer();
  const navigateThreedCamera = useNavigateThreedCameraToAnnotation();

  // Template candidates: same type for the dropdown (the clone candidates
  // live in CloneAnnotationFlow)
  const { candidates: sameTypeCandidates, listings: sameTypeListings } =
    useAnnotationTemplateCandidates(selectedAnnotation, {
      variant: "sameType",
    }) ?? {};

  // Same raw mode as NodeSegmentLengthsStatic: its overlay row only exists
  // in EDIT and in "no mode".
  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );

  // state

  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);

  // helpers

  const isMixedPart = hasPart && part.kind === "MIXED";

  // "Dupliquer" + the edit tools live in the quick-action row above the
  // annotation when it has one (overlay "Dupliquer" / "Evider" / "Plus
  // d'outils"); the toolbar keeps them only as a fallback: annotation types
  // without that row, interaction modes that hide it.
  const hasOverlayActions =
    hasOverlayRow &&
    getAnnotationHasOverlayActions(selectedAnnotation) &&
    (interactionMode == null || interactionMode === "EDIT");
  const { disabled: cloneDisabled, tooltip: cloneTooltip } =
    getCloneAnnotationPartState(part);
  const showCloneInToolbar =
    !hasOverlayActions && !(hasPart && part.kind === "POINT");
  const showArcifySelectedPoints =
    isMixedPart && ["POLYLINE", "POLYGON"].includes(selectedAnnotation?.type);
  // Whole annotation: layer chip + delete at least. Sub-selection: only the
  // part actions, none of which may remain once "Dupliquer" is on the overlay.
  const showActionsRow =
    !hasPart || showCloneInToolbar || showArcifySelectedPoints;

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
    await changeAnnotationTemplate(selectedAnnotation, template);
    handleTemplateDropdownClose();
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

  // LINEAR_LAYOUT: band width L (bar length, meters) — replaces the height
  // field in the geometry row.
  async function handleWidthChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      width: updatedAnnotation.width,
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

  async function handleIsExtChange(checked) {
    if (!selectedAnnotation?.id) return;
    await updateAnnotation({ id: selectedAnnotation.id, isExt: checked });
  }

  async function handleRevolutionSolidChange(checked) {
    if (!selectedAnnotation?.id) return;
    await updateAnnotation({
      id: selectedAnnotation.id,
      shape3D: { ...(selectedAnnotation.shape3D ?? {}), solid: checked },
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

  // Revolution helpers are standalone, template-less annotations — render a
  // dedicated compact toolbar instead of the full template-centric UI below.
  // (All hooks above have already run.)
  if (selectedAnnotation?.type === "REVOLUTION_AXIS") {
    return <ToolbarEditRevolutionAxis onDragStart={onDragStart} />;
  }
  if (selectedAnnotation?.type === "REVOLUTION_AXIS_PLACEMENT") {
    return <ToolbarEditRevolutionAxisPlacement onDragStart={onDragStart} />;
  }
  // Read-only projection of an annotation hosted by another base map: the only
  // meaningful action is to go and open the real one.
  if (selectedAnnotation?.isForeignFootprint) {
    return <ToolbarEditForeignFootprint onDragStart={onDragStart} />;
  }
  // Faces / edges of the annotation's mesh selected (3D): the toolbar shows
  // that selection, not the whole annotation.
  if (mesh3dParts.parts.length > 0) {
    return <ToolbarEditMesh3dParts onDragStart={onDragStart} />;
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

              <Tooltip title="Changer le modèle">
                <ButtonBase
                  onClick={handleTemplateDropdownClick}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{
                    minWidth: 0,
                    justifyContent: "flex-start",
                    gap: 0.5,
                    px: 0.5,
                    py: 0.25,
                    borderRadius: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
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

                  <ArrowDropDownIcon
                    sx={{ fontSize: 20, flexShrink: 0, color: "text.disabled" }}
                  />
                </ButtonBase>
              </Tooltip>

              <Box sx={{ flex: 1, minWidth: 0 }} />

              <Tooltip title="Copy annotation data">
                <IconButton
                  size="small"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    if (selectedAnnotation) {
                      const data = stringifyAnnotationData(selectedAnnotation);
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

        {/* Guide line edit row — slope (%) / ΔH (m) / inverser */}
        {hasPart && part.kind === "GUIDE" && (
          <ToolbarEditGuideLine accentColor={accentColor} />
        )}

        {/* Iso height line edit row — height (m) / delete */}
        {hasPart && part.kind === "ISO" && (
          <ToolbarEditIsoHeightLine accentColor={accentColor} />
        )}

        {/* Profile line edit row — open Élévation panel / delete */}
        {hasPart && part.kind === "PROFILE" && (
          <ToolbarEditProfileLine accentColor={accentColor} />
        )}

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
            {/* LINEAR_LAYOUT: the vertical height is meaningless — show the
                band width L (bar length) instead. */}
            {selectedAnnotation?.type === "LINEAR_LAYOUT" ? (
              <FieldAnnotationHeight
                annotation={selectedAnnotation}
                onChange={handleWidthChange}
                field="width"
                label="L"
                disabled={isLocked("width")}
              />
            ) : (
              // isMesh3d: the solid is the stored mesh (push/pull in 3D), the
              // extrusion heights do not drive it.
              !selectedAnnotation?.isMesh3d &&
              selectedAnnotation?.shape3D?.key !== "REVOLUTION" &&
              selectedAnnotation?.shape3D?.key !== "EXTRUSION_PROFILE" && (
                <FieldAnnotationHeight
                  annotation={selectedAnnotation}
                  onChange={handleHeightChange}
                  disabled={isLocked("height")}
                />
              )
            )}
            {selectedAnnotation?.type === "POLYGON" &&
              !selectedAnnotation?.isMesh3d && (
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
            {(isPolylineOrStrip || selectedAnnotation?.type === "POLYGON") && (
              <FieldAnnotationIsExtSwitch
                checked={Boolean(selectedAnnotation?.isExt)}
                onChange={handleIsExtChange}
                disabled={isLocked("isExt")}
              />
            )}
            {selectedAnnotation?.type === "POLYLINE" &&
              selectedAnnotation?.shape3D?.key === "REVOLUTION" && (
                <FieldAnnotationRevolutionSolidSwitch
                  checked={selectedAnnotation?.shape3D?.solid === true}
                  onChange={handleRevolutionSolidChange}
                  disabled={isLocked("shape3D")}
                />
              )}
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

        {/* Row 3b - Procedure launch (only when template is linked to a CREATOR procedure) */}
        {!hasPart && <RowProcedureActionAuto annotation={selectedAnnotation} />}

        {/* Row 4 - Actions row */}
        {showActionsRow && (
          <ToolbarAnnotationActions
            accentColor={accentColor}
            hideClone
            hideResize
            onDelete={handleDeleteClick}
            hideDelete={hasPart}
            extraActions={
              <>
                {showCloneInToolbar && (
                  <ButtonCloneAnnotation
                    key={selectedAnnotation?.id}
                    variant="toolbar"
                    accentColor={accentColor}
                    disabled={cloneDisabled}
                    tooltip={cloneTooltip}
                  />
                )}
                {hasPart ? (
                  showArcifySelectedPoints ? (
                    <IconButtonArcifySelectedPoints
                      annotation={selectedAnnotation}
                      pointIds={part.pointIds}
                      accentColor={accentColor}
                    />
                  ) : null
                ) : !hasOverlayActions ? (
                  <EditAnnotationTools
                    selectedAnnotation={selectedAnnotation}
                    accentColor={accentColor}
                    isClosedShape={isClosedShape}
                  />
                ) : null}
              </>
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
        )}

        {/* Row 5 - Zones band (ZONES module): link the selection to zones */}
        {!hasPart && selectedAnnotation && (
          <SectionZonesBandInToolbar annotations={[selectedAnnotation]} />
        )}

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

      </Paper>

    </Box>
  );
}
