import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  setSelectedListingId,
  setScopeModuleShowAllListings,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  IconButton,
  InputBase,
  Divider,
  Tooltip,
  Chip,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Add from "@mui/icons-material/Add";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Tune from "@mui/icons-material/Tune";
import FormatColorFill from "@mui/icons-material/FormatColorFill";
import { Check, Close } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import SectionBaseMapLinkClones from "Features/baseMapLinks/components/SectionBaseMapLinkClones";
import { isLegacyStyleRevolutionHelper } from "Features/annotations/constants/drawingShapeConfig";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import SectionListingProcedures from "Features/annotationsAuto/components/SectionListingProcedures";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";
import PopperSubtractHelper from "Features/mapEditor/components/PopperSubtractHelper";
import PopperDrawingHelper from "Features/mapEditor/components/PopperDrawingHelper";
import PopperPasteHelper from "Features/mapEditor/components/PopperPasteHelper";
import ToolPickerMenu from "Features/mapEditor/components/ToolPickerMenu";
import WarningBaseMapNotToScale from "Features/mapEditor/components/WarningBaseMapNotToScale";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import SectionLayers from "Features/layers/components/SectionLayers";
import {
  setShowLayers,
  setCollapsed,
  setViewerContentMode,
} from "Features/popperMapListings/popperMapListingsSlice";
import { setShowAnnotations } from "Features/baseMapEditor/baseMapEditorSlice";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";
import ToggleContentMode from "Features/popperMapListings/components/ToggleContentMode";
import SectionPopperScopeContent from "Features/popperMapListings/components/SectionPopperScopeContent";
import useScopeListing from "Features/listingViewer/hooks/useScopeListing";
import useScopeGridAnnotationsFilter from "Features/listingViewer/hooks/useScopeGridAnnotationsFilter";
import { selectBaseMapsGridScopeOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonToggleDetached from "Features/popperMapListings/components/IconButtonToggleDetached";
import RowOrphanAnnotations from "Features/mapEditor/components/RowOrphanAnnotations";
import RowTemplatelessAnnotations from "Features/mapEditor/components/RowTemplatelessAnnotations";
import PanelFooter from "Features/layout/components/PanelFooter";
import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";
import useLayers from "Features/layers/hooks/useLayers";
import { alpha } from "@mui/material/styles";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "Features/mapEditor/mapEditorSlice";
import selectEffectiveInteractionMode from "Features/popperMapListings/utils/selectEffectiveInteractionMode";
import selectIsBaseMapsLegendPopper from "Features/popperMapListings/utils/selectIsBaseMapsLegendPopper";

import {
  setNewAnnotation,
  setSoloAnnotationTemplateId,
  setSoloRevolutionAxisId,
} from "Features/annotations/annotationsSlice";
import {
  setAnnotationTemplatesHidden,
  toggleAnnotationTemplateHidden,
} from "Features/scopeVisibility/scopeVisibilitySlice";
import SectionRevolutionAxes from "Features/revolutionAxes/components/SectionRevolutionAxes";
import IconButtonCreateBaseMapListing from "Features/baseMapEditor/components/IconButtonCreateBaseMapListing";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";
import {
  TEMPLATELESS_LABEL,
  TEMPLATELESS_TEMPLATE_ID,
  isTemplatelessAnnotationInScope,
} from "Features/annotations/utils/templatelessAnnotations";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import useListings from "Features/listings/hooks/useListings";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import getLinkedListingReadOnlyMessage from "Features/listings/utils/getLinkedListingReadOnlyMessage";
import { setToaster } from "Features/layout/layoutSlice";
import FieldActiveListing from "Features/panelDrawing/components/FieldActiveListing";
import BandActiveListing from "Features/panelDrawing/components/BandActiveListing";
import useProjectPhotos from "Features/photos/hooks/useProjectPhotos";
import SectionPopperPhotos from "Features/photos/components/SectionPopperPhotos";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useSelectedZone from "Features/zonings/hooks/useSelectedZone";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import useReorderAnnotationTemplates from "Features/annotations/hooks/useReorderAnnotationTemplates";
import useDrawFromTemplate from "Features/mapEditor/hooks/useDrawFromTemplate";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import mergePaintedQtiesIntoTemplateQties from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import getStrokeWidthLabel from "Features/annotations/utils/getStrokeWidthLabel";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";
import {
  getBusinessObjectTypeKeyFromModuleKey,
  isBusinessObjectsModuleKey,
} from "Features/businessObjects/utils/businessObjectModuleKeys";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";
import useBusinessObjectsModuleLabel from "Features/businessObjects/hooks/useBusinessObjectsModuleLabel";
import SectionPopperBusinessObjects from "Features/popperMapListings/components/SectionPopperBusinessObjects";

// ---------------------------------------------------------------------------
// SortableAnnotationTemplateRow — wrapper for DnD
// ---------------------------------------------------------------------------

function SortableAnnotationTemplateRow({
  RowComponent = AnnotationTemplateRow,
  ...props
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.annotationTemplate.id });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <RowComponent
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={sortableStyle}
      sortableAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

// ---------------------------------------------------------------------------
// AnnotationTemplateRow — one template inside an expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplateRow({
  annotationTemplate,
  count,
  qtyLabel,
  listingId,
  spriteImage,
  sortableRef,
  sortableStyle,
  sortableAttributes,
  dragListeners,
  // "Nouvelle zone" section (ZONES module) and COTE templates in the Maillage
  // module: the row stays a DRAW entry even though the module forces the
  // listings into SELECT.
  forceDrawMode,
  // REVOLUTION_AXIS icon: inverted T on a vertical base map, circle + centre
  // point on the plan.
  isVerticalBaseMap,
  // Listing linked from another scope ("Depuis un autre Krto"): the row is a
  // read-only display entry — no draw / edit / tool / reassign, no drag; the
  // eye and the solo stay (host-side display actions).
  readOnly = false,
}) {
  const dispatch = useDispatch();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // strings

  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";

  // data

  const appConfig = useAppConfig();
  // state

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);
  // Tool resolution + start-draw dispatches (shared with the Dessin panel).
  const {
    drawingShape,
    tools,
    activeTool,
    hasFixedTool,
    nextDraftProps,
    startDraw,
    selectToolAndDraw,
  } = useDrawFromTemplate(annotationTemplate, listingId);
  // Module / display overrides (Maillage, 3D, ?mode=viewer, ZONES → SELECT;
  // business-objects module without an active object → EDIT) → use the
  // effective mode for all behavior gating in this row.
  const effectiveInteractionMode = useSelector(selectEffectiveInteractionMode);
  // The label wraps on several lines instead of being truncated behind a
  // tooltip (Dessin popper as well as the read-only Viewer legend).
  const wrapLabel = true;
  const interactionMode = forceDrawMode ? "DRAW" : effectiveInteractionMode;
  // With a wrapping label, the right column must keep the quantity's width on
  // hover (eye overlaid) — otherwise the label reflows and the row jumps.
  const keepQtySlot = wrapLabel && interactionMode === "SELECT";
  const selectedItem = useSelector((s) => s.selection.selectedItems[0] || null);
  const isEditTarget =
    (interactionMode === "EDIT" || interactionMode === "SELECT") &&
    selectedItem?.type === "ANNOTATION_TEMPLATE" &&
    selectedItem.id === annotationTemplate?.id;
  // Maillage module: this row is the only entry point of the 2-click cote mode,
  // so it shows the armed state itself (the panel stays a legend in 3D — no
  // PopperDrawingHelper swap) and a second click disarms it.
  const isArmedCoteRow = useSelector(
    (s) =>
      Boolean(forceDrawMode) &&
      s.mapEditor.enabledDrawingMode === "COTE_TWO_CLICK" &&
      s.annotations.newAnnotation?.annotationTemplateId ===
        annotationTemplate?.id
  );
  const isHighlighted = isEditTarget || isArmedCoteRow;
  // Template SOLO (transient render filter, see useAnnotationsV2): toggled
  // from the row icon, exited from the orange band at the bottom of the panel.
  const isSolo = useSelector(
    (s) =>
      Boolean(annotationTemplate?.id) &&
      s.annotations.soloAnnotationTemplateId === annotationTemplate.id
  );

  // helpers

  const isHidden = annotationTemplate?.hidden;
  const ActiveToolIcon = activeTool?.Icon;
  // POLYLINE: thickness of the next drawn stroke, shown under the icon line.
  const strokeWidthLabel =
    drawingShape === "POLYLINE" ? getStrokeWidthLabel(nextDraftProps) : null;

  // handlers

  const handleStartDraw = () => {
    if (isEditing) return;
    startDraw();
  };

  const handleToggleSolo = (e) => {
    // Keep the row click (draw / select) out of it.
    e.stopPropagation();
    dispatch(
      setSoloAnnotationTemplateId(isSolo ? null : annotationTemplate?.id)
    );
  };

  const handleSelectAsEditTarget = () => {
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
        listingId,
      })
    );
  };

  const handleRowClick = () => {
    if (isEditing) return;
    if (readOnly) {
      dispatch(
        setToaster({
          message: getLinkedListingReadOnlyMessage(appConfig),
          isError: true,
        })
      );
      return;
    }
    // Armed cote row (Maillage module): click again to disarm — same dispatch
    // pair as the Esc handler of useDimensionPointerHandlers, so the bridge
    // deactivates the 3D dimension mode.
    if (isArmedCoteRow) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      return;
    }
    switch (interactionMode) {
      case "EDIT":
      case "SELECT":
        handleEditTemplate();
        return;
      case null: // "no mode" draws, like DRAW
      case "DRAW":
      default:
        handleStartDraw();
        return;
    }
  };

  const handleStartReassign = (e) => {
    e.stopPropagation();
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
        listingId,
      })
    );
    dispatch(setEnabledDrawingMode("REASSIGN_TEMPLATE"));
  };

  const handleToolBtnClick = (e) => {
    e.stopPropagation();
    // REVOLUTION_AXIS: no tool picker — the click is a no-op.
    if (hasFixedTool) return;
    setToolMenuAnchor(e.currentTarget);
  };

  const handleSelectTool = (tool) => {
    // EDIT (Modification): the picker only records the template's tool — a
    // draw must not start from a row that edits instead of drawing.
    if (interactionMode === "EDIT") {
      dispatch(
        setSelectedToolKeyForTemplate({
          templateId: annotationTemplate?.id,
          toolKey: tool.key,
        })
      );
      return;
    }
    selectToolAndDraw(tool);
  };

  const handleEditTemplate = () => {
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // Template eye: per-scope local state (scopeVisibility slice), not a
  // template write — works on a foreign private scope too.
  const handleToggleHidden = (e) => {
    e.stopPropagation();
    dispatch(toggleAnnotationTemplateHidden(annotationTemplate?.id));
  };

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setTempLabel(annotationTemplate.label ?? "");
    setIsEditing(true);
  };

  const handleConfirmEdit = async () => {
    await updateAnnotationTemplate({
      ...annotationTemplate,
      label: tempLabel,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // render

  return (
    <Box
      ref={sortableRef}
      style={sortableStyle}
      {...(sortableAttributes ?? {})}
    >
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!toolMenuAnchor) setIsHovered(false);
        }}
        sx={{
          position: "relative",
          bgcolor: isHighlighted
            ? alpha(
                annotationTemplate?.fillColor ??
                  annotationTemplate?.strokeColor ??
                  "#1976d2",
                0.18
              )
            : "white",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 1,
          pr: 1,
          py: 0.5,
          borderLeft: "3px solid",
          borderColor: isHighlighted
            ? (annotationTemplate?.fillColor ??
              annotationTemplate?.strokeColor ??
              "primary.main")
            : isHovered
              ? (annotationTemplate?.fillColor ??
                annotationTemplate?.strokeColor ??
                "transparent")
              : "transparent",
          "&:hover": {
            bgcolor: alpha(
              annotationTemplate?.fillColor ??
                annotationTemplate?.strokeColor ??
                "#999",
              0.1
            ),
          },
        }}
      >
        {/* Drag handle */}
        <Box
          {...(readOnly ? {} : (dragListeners ?? {}))}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: readOnly ? "default" : "grab",
            opacity: isHovered && !readOnly ? 1 : 0,
            transition: "opacity 0.15s",
            mr: 0.5,
            flexShrink: 0,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 16, color: "panel.textLight" }} />
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Template icon = SOLO toggle (icon-button shape on row hover) */}
          <Tooltip
            title={isEditing ? "" : isSolo ? exitSoloS : soloS}
            arrow
            placement="left"
          >
            <Box
              onClick={isEditing ? undefined : handleToggleSolo}
              onDoubleClick={(e) => e.stopPropagation()}
              sx={(theme) => ({
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                mr: 1,
                flexShrink: 0,
                borderRadius: 1,
                transition: "background-color 120ms, box-shadow 120ms",
                ...(isSolo && {
                  bgcolor: alpha(theme.palette.secondary.main, 0.15),
                  boxShadow: `0 0 0 2px ${theme.palette.secondary.main}`,
                }),
                // Button shape as soon as the whole row is hovered (shows the
                // icon is clickable), stronger shadow on the icon itself.
                ...(!isEditing &&
                  isHovered && {
                    bgcolor: "background.paper",
                    boxShadow: isSolo
                      ? `0 0 0 2px ${theme.palette.secondary.main}, ${theme.shadows[1]}`
                      : `0 0 0 1px ${theme.palette.panel.border}, ${theme.shadows[1]}`,
                  }),
                ...(!isEditing && {
                  cursor: "pointer",
                  "&:hover": {
                    bgcolor: "background.paper",
                    boxShadow: isSolo
                      ? `0 0 0 2px ${theme.palette.secondary.main}, ${theme.shadows[3]}`
                      : `0 0 0 1px ${theme.palette.panel.border}, ${theme.shadows[3]}`,
                  },
                }),
              })}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isHidden ? 0.4 : 1,
                  filter: isHidden ? "grayscale(100%)" : "none",
                }}
              >
                <AnnotationTemplateIcon
                  template={annotationTemplate}
                  size={18}
                  spriteImage={spriteImage}
                  revolutionAxisVertical={isVerticalBaseMap}
                />
              </Box>
              {strokeWidthLabel && (
                <Typography
                  component="span"
                  sx={{
                    position: "absolute",
                    left: "50%",
                    bottom: -1,
                    transform: "translateX(-50%)",
                    fontSize: "7px",
                    lineHeight: 1,
                    fontFamily: "monospace",
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {strokeWidthLabel}
                </Typography>
              )}
            </Box>
          </Tooltip>
          {isEditing ? (
            <InputBase
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmEdit();
                else if (e.key === "Escape") handleCancelEdit();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              sx={{ fontSize: "0.875rem", flex: 1 }}
            />
          ) : (
            <Tooltip
              title={wrapLabel ? "" : (annotationTemplate.label ?? "")}
              placement="top-start"
              enterDelay={600}
            >
              <Typography
                variant="body2"
                color={isHidden ? "text.disabled" : "panel.textPrimary"}
                sx={{
                  lineHeight: 1.3,
                  userSelect: "none",
                  ...(wrapLabel
                    ? {
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        minWidth: 0,
                      }
                    : {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }),
                }}
              >
                {annotationTemplate.label}
                {annotationTemplate.height != null && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "10px",
                      color: "text.secondary",
                      ml: 0.5,
                    }}
                  >
                    [ht. {annotationTemplate.height}m]
                  </Typography>
                )}
              </Typography>
            </Tooltip>
          )}
        </Box>

        {/* Right side: edit confirm/cancel OR tool+visibility (hover) OR qty */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            position: "relative",
            gap: 0.5,
            ml: 1,
            minWidth: 56,
            flexShrink: 0,
          }}
        >
          {isEditing ? (
            <>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmEdit();
                }}
                sx={{ color: "success.main", p: 0.5 }}
              >
                <Check fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                sx={{ color: "error.main", p: 0.5 }}
              >
                <Close fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          ) : isHovered && !keepQtySlot ? (
            interactionMode === "EDIT" ? (
              /* EDIT mode — reassign-template (paint bucket) + visibility */
              <>
                {!readOnly && (
                  <Tooltip
                    title="Modifier le modèle d'une annotation"
                    arrow
                    placement="bottom"
                  >
                    <IconButton
                      size="small"
                      onClick={handleStartReassign}
                      sx={{
                        p: 0.5,
                        color:
                          annotationTemplate?.fillColor ??
                          annotationTemplate?.strokeColor ??
                          "panel.textMuted",
                      }}
                    >
                      <FormatColorFill
                        fontSize="inherit"
                        sx={{ fontSize: 16 }}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip
                  title={isHidden ? "Afficher" : "Masquer"}
                  arrow
                  placement="right"
                >
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={{
                      p: 0.5,
                      color: isHidden ? "secondary.main" : "panel.iconMuted",
                    }}
                  >
                    {isHidden ? (
                      <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                {/* Properties + tool buttons hidden in SELECT mode (read-only)
                    and for a listing linked from another scope */}
                {interactionMode !== "SELECT" && !readOnly && (
                  <>
                    {/* Properties button */}
                    <Tooltip title="Propriétés" arrow placement="bottom">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate();
                        }}
                        sx={{
                          p: 0.25,
                          color:
                            annotationTemplate?.fillColor ??
                            annotationTemplate?.strokeColor ??
                            "panel.textMuted",
                        }}
                      >
                        <Tune sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {/* Active tool button */}
                    {ActiveToolIcon && (
                      <Tooltip
                        title={
                          hasFixedTool
                            ? (activeTool?.label ?? "")
                            : "Changer d'outil"
                        }
                        arrow
                      >
                        <IconButton
                          size="small"
                          onClick={handleToolBtnClick}
                          sx={{
                            p: 0.5,
                            bgcolor: Boolean(toolMenuAnchor)
                              ? (annotationTemplate?.fillColor ??
                                annotationTemplate?.strokeColor ??
                                "grey.500")
                              : alpha(
                                  annotationTemplate?.fillColor ??
                                    annotationTemplate?.strokeColor ??
                                    "#999",
                                  0.15
                                ),
                            color: Boolean(toolMenuAnchor)
                              ? "white"
                              : (annotationTemplate?.fillColor ??
                                annotationTemplate?.strokeColor ??
                                "grey.500"),
                            borderRadius: 1,
                            "&:hover": {
                              bgcolor:
                                annotationTemplate?.fillColor ??
                                annotationTemplate?.strokeColor ??
                                "grey.500",
                              color: "white",
                            },
                          }}
                        >
                          <ActiveToolIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
                {/* Visibility button */}
                <Tooltip
                  title={isHidden ? "Afficher" : "Masquer"}
                  arrow
                  placement="right"
                >
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={{
                      p: 0.5,
                      color: isHidden ? "secondary.main" : "panel.iconMuted",
                    }}
                  >
                    {isHidden ? (
                      <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </>
            )
          ) : (
            <>
              <Typography
                align="right"
                noWrap
                sx={{
                  fontSize: "10px",
                  minWidth: "40px",
                  fontFamily: "monospace",
                  fontWeight: 500,
                  // keepQtySlot: still in the layout on hover, under the eye.
                  visibility: isHovered ? "hidden" : "visible",
                }}
                color={
                  isHidden
                    ? "text.disabled"
                    : count > 0
                      ? "secondary.main"
                      : "panel.countEmpty"
                }
              >
                {qtyLabel}
              </Typography>
              {isHovered && (
                <Box
                  sx={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                  }}
                >
                  <Tooltip
                    title={isHidden ? "Afficher" : "Masquer"}
                    arrow
                    placement="right"
                  >
                    <IconButton
                      size="small"
                      onClick={handleToggleHidden}
                      sx={{
                        p: 0.5,
                        color: isHidden ? "secondary.main" : "panel.iconMuted",
                      }}
                    >
                      {isHidden ? (
                        <VisibilityOff
                          fontSize="inherit"
                          sx={{ fontSize: 16 }}
                        />
                      ) : (
                        <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </>
          )}
        </Box>
      </ListItemButton>

      {/* Tool picker menu */}
      <ToolPickerMenu
        anchorEl={toolMenuAnchor}
        open={Boolean(toolMenuAnchor)}
        onClose={() => {
          setToolMenuAnchor(null);
          setIsHovered(false);
        }}
        annotationTemplate={annotationTemplate}
        tools={tools}
        onSelectTool={handleSelectTool}
        onEdit={handleEditTemplate}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AnnotationTemplatesForListing — templates list for one expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplatesForListing({
  listingId,
  annotations,
  annotationTemplateById,
  // Painted m² / ml of the templates (« Pinceau » 3D), merged into the
  // annotation quantities of the rows.
  paintedQtiesByTemplateId,
  visibleTemplateIds,
  // "Nouveau modèle" draft defaults (e.g. the isBusinessObjectAnnotation
  // flag of a business-objects listing's location templates).
  templateDefaults,
  // Listing linked from another scope: read-only rows, no reorder, no
  // "Nouveau modèle".
  readOnly = false,
}) {
  // data

  const allTemplates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByOrder: true,
  });

  // In SELECT contexts, only show templates that have a visible annotation.
  const annotationTemplates = useMemo(
    () =>
      visibleTemplateIds
        ? (allTemplates ?? []).filter((t) => visibleTemplateIds.has(t.id))
        : allTemplates,
    [allTemplates, visibleTemplateIds]
  );
  const spriteImage = useAnnotationSpriteImage();
  const reorderAnnotationTemplates = useReorderAnnotationTemplates();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const isThreedViewer = useSelector((s) =>
    isThreedFamilyViewerKey(s.viewers.selectedViewerKey)
  );
  // Maillage module: COTE template rows stay drawing entries (2-click cote on
  // the mailles) although the module forces the panel into SELECT.
  const isMeshesModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "MESHES"
  );
  const baseMap = useMainBaseMap();
  const isVerticalBaseMap = baseMap?.orientation === "VERTICAL";
  const qtiesById = useMemo(
    () =>
      mergePaintedQtiesIntoTemplateQties(
        computeAnnotationTemplateQties(annotations, annotationTemplateById),
        paintedQtiesByTemplateId,
        annotationTemplateById
      ),
    [annotations, annotationTemplateById, paintedQtiesByTemplateId]
  );

  // helpers - grouped templates (with group headers inserted)

  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(annotationTemplates),
    [annotationTemplates]
  );

  // helpers - sortable IDs (only real templates, not group headers)

  const sortableIds = useMemo(
    () => (annotationTemplates ?? []).map((t) => t.id),
    [annotationTemplates]
  );

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // dnd sensors

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // dnd handlers

  const handleDragEnd = useCallback(
    (event) => {
      if (readOnly) return;
      reorderAnnotationTemplates(event, annotationTemplates);
    },
    [reorderAnnotationTemplates, annotationTemplates, readOnly]
  );

  // render

  return (
    <Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <List dense disablePadding>
            {groupedItems?.map((item, idx) => {
              if (item.isGroupDivider) {
                return (
                  <Divider
                    key={`divider-${idx}`}
                    sx={{ mx: 3, my: 0.5, borderColor: "divider" }}
                  />
                );
              }
              if (item.isGroupHeader) {
                return (
                  <Typography
                    key={`group-${item.groupLabel}`}
                    variant="caption"
                    sx={{
                      display: "block",
                      pl: 3,
                      pt: idx > 0 ? 1 : 0.5,
                      pb: 0.5,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.groupLabel}
                  </Typography>
                );
              }
              if (item?.isDivider) return null;
              // A BASE_MAP_LINK section mark is authored on plans only; on a
              // vertical base map its clones come from the dedicated
              // "Coupes / élévations liées" section (SectionBaseMapLinkClones).
              if (
                isVerticalBaseMap &&
                resolveDrawingShape(item) === "BASE_MAP_LINK"
              )
                return null;
              const templateQties = qtiesById?.[item.id];
              // Annotations + parts painted in 3D with the template: both
              // are counted (colored main quantity).
              const count =
                (templateQties?.count || 0) +
                (templateQties?.paintedCount || 0);
              const qtyLabel = templateQties?.mainQtyLabel;
              return (
                <SortableAnnotationTemplateRow
                  key={item.id}
                  annotationTemplate={item}
                  count={count}
                  qtyLabel={qtyLabel}
                  listingId={listingId}
                  spriteImage={spriteImage}
                  isVerticalBaseMap={isVerticalBaseMap}
                  forceDrawMode={
                    isMeshesModule && resolveDrawingShape(item) === "COTE"
                  }
                  readOnly={readOnly}
                />
              );
            })}
          </List>
        </SortableContext>
      </DndContext>

      {/* « Annot. sans modèle » (orphan annotations of the listing) then
          + Nouveau modele — hidden in 3D (read-only), while SELECT-filtering
          and for a listing linked from another scope */}
      {!isThreedViewer && !visibleTemplateIds && !readOnly && (
        <RowOrphanAnnotations listingId={listingId} variant="popper" />
      )}
      {!isThreedViewer && !visibleTemplateIds && !readOnly && (
        <ListItemButton
          onClick={() => setOpenCreateDialog(true)}
          sx={{
            pl: 3,
            pr: 1,
            py: 0.5,
            alignItems: "center",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              mr: 1,
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                border: "1.5px dashed",
                borderColor: "panel.textLight",
                borderRadius: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Add sx={{ fontSize: 12, color: "panel.textLight" }} />
            </Box>
          </Box>
          <Typography variant="body2" color="panel.textLight">
            Nouveau modèle
          </Typography>
        </ListItemButton>
      )}

      {/* procedures linked to the listing ("Dessin auto"), below the add
          row — hidden in 3D (read-only), while SELECT-filtering and for a
          listing linked from another scope */}
      {!isThreedViewer && !visibleTemplateIds && !readOnly && (
        <SectionListingProcedures
          listingId={listingId}
          baseMapId={selectedBaseMapId}
        />
      )}

      {openCreateDialog && (
        <DialogCreateAnnotationTemplate
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          listingId={listingId}
          templateDefaults={templateDefaults}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ListingRow — one listing with expand/collapse and visibility toggle
// ---------------------------------------------------------------------------

function ListingRow({
  listing,
  isExpanded,
  onToggleExpand,
  annotationCount,
  annotations,
  annotationTemplateById,
  paintedQtiesByTemplateId,
  visibleTemplateIds,
  extraAction,
  // "band" mode: the single selected listing shown below the chips bar — always
  // expanded, no chevron, clicking the header opens its properties.
  alwaysExpanded = false,
  hideCaret = false,
  // The FieldActiveListing selector already names the active listing: skip
  // the redundant header band and render the templates only.
  hideHeader = false,
}) {
  const dispatch = useDispatch();

  // strings

  const fromS = "Depuis";

  // state

  const [isHovered, setIsHovered] = useState(false);

  // data

  // Listing linked from another scope ("Depuis un autre Krto"): read-only
  // band in palette.listingFromOtherScope, with the source scope's name.
  const { isLinkedListing, getSourceScope } = useLinkedListings();
  const isLinked = isLinkedListing(listing?.id);
  const sourceScope = isLinked ? getSourceScope(listing?.id) : null;

  // helpers

  // The listing eye mirrors the template eyes: off when every template of the
  // listing is hidden.
  const listingTemplates = useMemo(
    () =>
      Object.values(annotationTemplateById ?? {}).filter(
        (t) => t.listingId === listing.id
      ),
    [annotationTemplateById, listing.id]
  );
  const isHidden =
    listingTemplates.length > 0 && listingTemplates.every((t) => t.hidden);

  // handlers

  // Toggle every template eye of the listing in one dispatch (per-scope
  // local state, scopeVisibility slice).
  function handleToggleVisibility(e) {
    e.stopPropagation();
    dispatch(
      setAnnotationTemplatesHidden({
        ids: listingTemplates.map((t) => t.id),
        hidden: !isHidden,
      })
    );
  }

  function handleListingClick() {
    onToggleExpand?.(listing.id);
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleOpenProperties(e) {
    e.stopPropagation();
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  if (hideHeader) {
    return (
      <AnnotationTemplatesForListing
        listingId={listing.id}
        annotations={annotations}
        annotationTemplateById={annotationTemplateById}
        paintedQtiesByTemplateId={paintedQtiesByTemplateId}
        visibleTemplateIds={visibleTemplateIds}
        readOnly={isLinked}
      />
    );
  }

  return (
    <Box>
      <Box
        onClick={alwaysExpanded ? handleOpenProperties : handleListingClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.75,
          cursor: "pointer",
          bgcolor: "panel.sectionBg",
          "&:hover": { bgcolor: "panel.border" },
          borderTop: "1px solid",
          borderColor: "panel.border",
          // Linked listing flag: left bar in the "other scope" colour.
          borderLeft: "3px solid",
          borderLeftColor: isLinked
            ? "listingFromOtherScope.main"
            : "transparent",
          opacity: isHidden ? 0.5 : 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flex: 1,
            minWidth: 0,
          }}
        >
          {!hideCaret && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                color: "panel.textLight",
              }}
            >
              {isExpanded ? (
                <ExpandMore sx={{ fontSize: 18 }} />
              ) : (
                <ChevronRight sx={{ fontSize: 18 }} />
              )}
            </Box>
          )}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: "panel.textPrimary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {listing.name ?? listing.label ?? "Liste"}
          </Typography>
          {isLinked && (
            <Tooltip
              title={sourceScope?.name ? `${fromS} ${sourceScope.name}` : ""}
              arrow
            >
              <Chip
                label={sourceScope?.name ?? fromS}
                size="small"
                sx={{
                  ml: 0.5,
                  height: 16,
                  maxWidth: 110,
                  bgcolor: "listingFromOtherScope.main",
                  color: "listingFromOtherScope.contrastText",
                  "& .MuiChip-label": { px: 0.75, fontSize: "10px" },
                }}
              />
            </Tooltip>
          )}
        </Box>

        {extraAction}

        {/* Right side: properties + visibility (hover) / count (default) */}
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}
        >
          <IconButton
            size="small"
            onClick={handleOpenProperties}
            sx={{
              p: 0,
              visibility: isHovered ? "visible" : "hidden",
            }}
          >
            <Tune sx={{ fontSize: 18 }} />
          </IconButton>
          <Box
            sx={{
              position: "relative",
              minWidth: 24,
              height: 24,
              flexShrink: 0,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                fontSize: "11px",
                fontWeight: 600,
                fontFamily: "monospace",
                color:
                  annotationCount > 0
                    ? isLinked
                      ? "listingFromOtherScope.main"
                      : "secondary.main"
                    : "panel.countEmpty",
                visibility: isHovered ? "hidden" : "visible",
              }}
            >
              {annotationCount}
            </Typography>
            <IconButton
              size="small"
              onClick={handleToggleVisibility}
              sx={{
                position: "absolute",
                inset: 0,
                p: 0,
                visibility: isHovered ? "visible" : "hidden",
              }}
            >
              {isHidden ? (
                <VisibilityOff sx={{ fontSize: 18 }} />
              ) : (
                <Visibility sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Box>
        </Box>
      </Box>

      {(alwaysExpanded || isExpanded) && (
        <AnnotationTemplatesForListing
          listingId={listing.id}
          annotations={annotations}
          annotationTemplateById={annotationTemplateById}
          paintedQtiesByTemplateId={paintedQtiesByTemplateId}
          visibleTemplateIds={visibleTemplateIds}
          readOnly={isLinked}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ListingChipsBar — horizontal band of listing "chips". Selecting a chip sets
// the current listing (selectedListingId); a trailing "+ Liste" chip creates a
// new listing. Replaces the former vertical accordion of listing rows.
// CURRENTLY UNUSED: replaced by FieldActiveListing (the Dessin left panel
// selector) — kept, with its commented call site below, in case the chip
// version needs to be reactivated.
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
function ListingChipsBar({
  listings,
  activeListingId,
  annotationCountByListingId,
  hiddenByListingId,
  onSelectListing,
  onToggleListingVisibility,
  showAddButton,
  hasNoListing,
  onAddListing,
  addLabel,
}) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.5,
        px: 1,
        py: 0.75,
        borderBottom: "1px solid",
        borderColor: "panel.border",
      }}
    >
      {listings?.map((listing) => {
        const selected = listing.id === activeListingId;
        const count = annotationCountByListingId?.[listing.id] || 0;
        const isHidden = Boolean(hiddenByListingId?.[listing.id]);
        const EyeIcon = isHidden ? VisibilityOff : Visibility;
        return (
          <Box
            key={listing.id}
            component="button"
            onClick={() => onSelectListing(listing.id)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              maxWidth: "100%",
              px: 1,
              py: 0.375,
              borderRadius: 4,
              border: "1px solid",
              cursor: "pointer",
              fontFamily: "inherit",
              bgcolor: selected ? "primary.main" : "panel.sectionBg",
              borderColor: selected ? "primary.main" : "panel.border",
              "&:hover": {
                bgcolor: selected ? "primary.dark" : "panel.border",
              },
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{
                fontWeight: 600,
                color: selected
                  ? "primary.contrastText"
                  : isHidden
                    ? "text.disabled"
                    : "panel.textPrimary",
                opacity: selected && isHidden ? 0.5 : 1,
              }}
            >
              {listing.name ?? listing.label ?? "Liste"}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: selected
                  ? "primary.contrastText"
                  : isHidden
                    ? "text.disabled"
                    : count > 0
                      ? "secondary.main"
                      : "panel.countEmpty",
                opacity: selected ? (isHidden ? 0.5 : 0.85) : 1,
              }}
            >
              {count}
            </Typography>
            {/* Not an IconButton: the chip itself is a <button>, nesting one
                would be invalid HTML. */}
            <Box
              component="span"
              onClick={(e) => {
                e.stopPropagation();
                onToggleListingVisibility?.(listing.id);
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                color: selected
                  ? "primary.contrastText"
                  : isHidden
                    ? "secondary.main"
                    : "panel.iconMuted",
              }}
            >
              <EyeIcon sx={{ fontSize: 14 }} />
            </Box>
          </Box>
        );
      })}

      {showAddButton && (
        <Box
          component="button"
          onClick={onAddListing}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 1,
            py: 0.375,
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "11px",
            ...(hasNoListing
              ? {
                  color: "white",
                  bgcolor: "secondary.main",
                  border: "1px solid",
                  borderColor: "secondary.main",
                  fontWeight: 600,
                  "&:hover": {
                    bgcolor: "secondary.dark",
                    borderColor: "secondary.dark",
                  },
                }
              : {
                  color: "panel.textLight",
                  bgcolor: "transparent",
                  border: "1px dashed",
                  borderColor: "panel.border",
                  "&:hover": {
                    borderColor: "panel.textMuted",
                    color: "panel.textMuted",
                  },
                }),
          }}
        >
          {addLabel}
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperMapListings — main floating panel (or drawing helper when drawing)
// ---------------------------------------------------------------------------

export default function PopperMapListings() {
  // strings

  // Only used by the commented ListingChipsBar call site (chip selector).
  // eslint-disable-next-line no-unused-vars
  const addListS = "+ Liste";
  const soloS = "Solo :";
  const scopeFilterS = "Filtre :";
  const exitScopeFilterS = "Afficher toutes les listes";
  const showAnnotationsS = "Afficher les annotations";
  const exitSoloS = "Quitter le solo";

  // data

  const dispatch = useDispatch();
  // Template SOLO (toggled from a template row icon): orange band at the
  // bottom of the panel, with the template name and an exit cross.
  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const soloTemplate = useLiveQuery(
    () =>
      soloTemplateId === TEMPLATELESS_TEMPLATE_ID
        ? { label: TEMPLATELESS_LABEL }
        : soloTemplateId
          ? db.annotationTemplates.get(soloTemplateId)
          : null,
    [soloTemplateId]
  );
  // Revolution-axis SOLO (toggled from an axis row icon): same band.
  const soloRevolutionAxisId = useSelector(
    (s) => s.annotations.soloRevolutionAxisId
  );
  const soloRevolutionAxis = useLiveQuery(
    () =>
      soloRevolutionAxisId ? db.annotations.get(soloRevolutionAxisId) : null,
    [soloRevolutionAxisId]
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const activeThreedTool = useSelector(selectActiveThreedTool);
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  // truthy in either subtraction pick direction (see utils/subtractPickMode)
  const subtractPickAnnotationId = useSelector(selectSubtractPickAnnotationId);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const showMapListingsPanel = useSelector(
    (s) => s.mapEditor.showMapListingsPanel
  );
  const isBaseMapsViewer = viewerKey === "BASE_MAPS";
  const isZonesViewer = viewerKey === "ZONES";
  const isThreedViewer = isThreedFamilyViewerKey(viewerKey);
  // POV module in "browse" state (capture frame off): the popper is shown over
  // the editor POV displays. When that editor is the 3D one, the 3D-specific
  // annotation filters must be mirrored exactly like in the 3D module —
  // isThreedViewer stays module-key based on purpose (Dessin-3D DRAW mode).
  const isPovViewer = viewerKey === "POINT_OF_VIEW";
  // Displayed editor (the Dessin module toggled to 3D): picks the drawing
  // tools offered (Coupe face in 3D, the plan cut / join tools in 2D).
  const isPovThreed = useSelector(
    (s) => isPovViewer && isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // Viewer module (read-only consultation): the popper is a bare legend —
  // listings + templates only, no editing affordances or warnings.
  const isViewerModule = viewerKey === "THREED";
  // Viewer module displaying its 2D editor: the panel scopes to the CURRENT
  // baseMap only (the extra-basemap mirroring is a 3D-scene concern).
  const isViewer2d = useSelector(
    (s) => viewerKey === "THREED" && selectEffectiveViewerKey(s) === "MAP"
  );
  // BaseMaps module (always a read-only legend, like the Viewer module),
  // shown with the left panel folded, over what the module's editor
  // displays — the scope annotations when the panel's "Afficher les
  // annotations" switch loads them (isBaseMapsLegendAll), nothing otherwise.
  const isBaseMapsLegend = useSelector(selectIsBaseMapsLegendPopper);
  const isBaseMapsLegendAll = useSelector(
    (s) => isBaseMapsLegend && s.baseMapEditor.showAnnotations
  );
  const isBaseMapsLegendThreed = useSelector(
    (s) =>
      isBaseMapsLegend && isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // SCOPE module (pinned base maps grid, read-only): same bare legend as the
  // Viewer module, plus the "Contenu" side (the scope content: every listing
  // of the scope whatever its nature) — the popper lands on it when the
  // module is entered (popperMapListingsSlice).
  const isScopeModule = viewerKey === "SCOPE";
  const { listing: scopeListing } = useScopeListing();
  // While its grid is displayed, the annotations legend mirrors it: the
  // sheets on the table (baseMapsGrid.scopeSheets) narrowed to the selected
  // listing (useScopeGridAnnotationsFilter) — all of them with "Afficher
  // toutes les listes". With the grid left, the legend is the main base
  // map's, like the Viewer 2D.
  const isScopeGridOpen = useSelector(selectBaseMapsGridScopeOpen);
  const scopeFilter = useScopeGridAnnotationsFilter();
  const scopeSheetIds = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.baseMapIds
  );
  const isLegendPopper = isViewerModule || isBaseMapsLegend || isScopeModule;
  // BaseMaps module legend with the "Afficher les annotations" switch OFF:
  // there is no annotations side — the popper is the base maps list only
  // (plain title, no toggle, attached whatever the detach flag).
  const isBaseMapsListOnly = isBaseMapsLegend && !isBaseMapsLegendAll;
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const mirrors3dFilters =
    (isThreedViewer && !isViewer2d) || isPovThreed || isBaseMapsLegendThreed;
  // Dessin module (2D or its 3D toggle): the footer switch "Fond de plan
  // sélectionné seul" (panelDrawing.viewerAnnotationsScope, shared with the
  // Dessin / Viewer panels' chips) scopes the annotations set — and so every
  // displayed quantity and counter — to the main base map, or to the whole
  // repérage ("ALL", the default). The legend poppers of the other modules
  // keep their own base map scoping.
  const isDessinPopper = viewerKey === "MAP";
  const viewerScope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);
  const isAllScope = isDessinPopper && viewerScope === "ALL";
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  // Raw popperMapListings.interactionMode overridden by the module / display
  // contexts (selectEffectiveInteractionMode): "Maillage" toggle, 3D viewers,
  // ?mode=viewer and the ZONES module force a read-only SELECT legend; a
  // business-objects module without an active object forces EDIT.
  const effectiveInteractionMode = useSelector(selectEffectiveInteractionMode);
  const collapsed = useSelector((s) => s.popperMapListings.collapsed);
  const selectedItem = useSelector((s) => s.selection.selectedItems[0] || null);

  // Ouvrages modules — the ACTIVE object is the popper's drawing context:
  // - LOCATED listing (opt-in listing.canLocateBusinessObjects): the popper
  //   narrows to the object — its name as title, the location templates of
  //   its listing (+ "Nouveau modèle"); drawing one of them LOCATES the object
  //   (see useDrawFromTemplate). No listing selector, no drawing tools.
  // - otherwise: plain Dessin panel titled with the object's name; every
  //   annotation drawn from a template LINKS to the object at commit
  //   (LINK_BUSINESS_OBJECT interceptor).
  // - no active object: the panel is edit-only (selectEffectiveInteractionMode
  //   forces EDIT) — template rows edit, only the cut / opening tools remain.
  // Keyed on the ACTIVE id, not on the selection: each committed annotation
  // selects itself, and the popper must keep its object across draws.
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects?.activeBusinessObjectId ?? null
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const activeBusinessObject = useLiveQuery(async () => {
    if (!isBusinessObjectsModuleKey(viewerKey) || !activeBusinessObjectId)
      return null;
    const o = await db.businessObjects.get(activeBusinessObjectId);
    return o && !o.deletedAt ? o : null;
  }, [viewerKey, activeBusinessObjectId, businessObjectsUpdatedAt]);
  // listingsById = Dexie mirror kept by dexieSyncService
  const activeBusinessObjectListing = useSelector((s) =>
    activeBusinessObject?.listingId
      ? (s.listings.listingsById?.[activeBusinessObject.listingId] ?? null)
      : null
  );
  const isBusinessObjectsModule = isBusinessObjectsModuleKey(viewerKey);
  const isLocateBusinessObjectMode =
    isBusinessObjectsModule &&
    Boolean(activeBusinessObject) &&
    canLocateBusinessObjects(activeBusinessObjectListing);
  const baseMap = useMainBaseMap();
  const layers = useLayers({ filterByBaseMapId: baseMap?.id });
  const versionsCount = baseMap?.versions?.length ?? 0;

  // Auto-enable showLayers when the baseMap has layers in the MAP viewer.
  // Enable only: a manual choice (Dessin properties panel / Configuration
  // page) is never forced back, and "on" without any layer stays on so the
  // first layer can be created from the section.
  useEffect(() => {
    if (viewerKey === "MAP" && layers?.length > 0) {
      dispatch(setShowLayers(true));
    }
  }, [layers?.length, viewerKey]);

  // 3D can show annotations from several base maps at once; mirror those extra
  // base maps here so the panel's visible set matches the 3D scene.
  const extraBaseMapIdsIn3d = useExtraBaseMapIdsIn3d();
  const extraBaseMapIds = useMemo(() => {
    if (!isScopeGridOpen) return extraBaseMapIdsIn3d;
    return scopeSheetIds.filter((id) => id !== baseMap?.id);
  }, [isScopeGridOpen, extraBaseMapIdsIn3d, scopeSheetIds, baseMap?.id]);

  // single annotation source for all counts and for the SELECT-mode visibility
  // filter. `ignoreSolo` keeps this set stable while a zone is soloed (zonings
  // module — soloing must not remove rows from the tree), `keepHiddenTemplates` keeps
  // eye-hidden templates' annotations so their rows stay in the tree (greyed)
  // and can be re-enabled. In 3D, the 3D-specific filters are mirrored so the
  // set matches what the scene actually shows. In the Dessin module, the
  // "ALL" scope widens the set to every base map of the selected scope.
  const allAnnotationsInclHidden = useAnnotationsV2({
    caller: "PopperMapListings",
    enabled:
      viewerKey === "MAP" ||
      isBaseMapsLegendAll ||
      viewerKey === "ZONES" ||
      isBusinessObjectsModuleKey(viewerKey) ||
      isPovViewer ||
      isThreedViewer ||
      isScopeModule,
    filterByMainBaseMap: !isAllScope,
    ...(isAllScope ? { filterBySelectedScope: true } : {}),
    hideBaseMapAnnotations: true,
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    ...(mirrors3dFilters
      ? {
          extraBaseMapIds,
          filterBySelectedScope: true,
          excludeProfileTemplates: true,
          excludeListingsIds: hiddenListingsIds,
        }
      : {}),
    // SCOPE module: the sheets of the displayed grid, the selected listing.
    ...(isScopeModule
      ? {
          extraBaseMapIds,
          filterBySelectedScope: true,
          excludeListingsIds: hiddenListingsIds,
          filterByListingId: isScopeGridOpen
            ? scopeFilter.filterByListingId
            : undefined,
        }
      : {}),
  });

  // « Annotations sans modèle » row (Dessin popper): the annotations drawn
  // without template in the selected scope, eye-hidden ones included like
  // the template rows — the same scoping as every counter of the panel.
  const templatelessAnnotations = useMemo(
    () =>
      (allAnnotationsInclHidden ?? []).filter((a) =>
        isTemplatelessAnnotationInScope(a, selectedScopeId)
      ),
    [allAnnotationsInclHidden, selectedScopeId]
  );

  // visible-only set for counts and qties (matches what's on screen).
  // SCOPE module narrowed to a business-objects listing: only the
  // annotations linked to its objects (same set as the grid).
  const scopeAnnotationIdSet = isScopeGridOpen
    ? scopeFilter.annotationIdSet
    : null;
  const allAnnotations = useMemo(
    () =>
      allAnnotationsInclHidden?.filter(
        (a) =>
          !a.hidden && (!scopeAnnotationIdSet || scopeAnnotationIdSet.has(a.id))
      ),
    [allAnnotationsInclHidden, scopeAnnotationIdSet]
  );

  const annotationTemplates = useAnnotationTemplates();
  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // Chip eyes mirror the listing-row eye: a listing is hidden when every one
  // of its templates is hidden.
  const templatesByListingId = useMemo(() => {
    return (annotationTemplates ?? []).reduce((acc, t) => {
      if (t.listingId) (acc[t.listingId] ??= []).push(t);
      return acc;
    }, {});
  }, [annotationTemplates]);

  const hiddenByListingId = useMemo(() => {
    const acc = {};
    Object.entries(templatesByListingId).forEach(([listingId, templates]) => {
      acc[listingId] = templates.length > 0 && templates.every((t) => t.hidden);
    });
    return acc;
  }, [templatesByListingId]);

  // ZONES module: the zone selected in the drawer drives the "Nouvelle zone"
  // section (its template row is the module's only drawing entry).
  const { template: selectedZoneTemplate } = useSelectedZone();
  const spriteImage = useAnnotationSpriteImage();
  const selectedZoneAnnotationsCount = useMemo(() => {
    if (!isZonesViewer || !selectedZoneTemplate) return 0;
    return (allAnnotationsInclHidden ?? []).filter(
      (a) => a.annotationTemplateId === selectedZoneTemplate.id
    ).length;
  }, [isZonesViewer, selectedZoneTemplate, allAnnotationsInclHidden]);

  // Template-linked revolution helpers count like any other annotation of
  // their listing. Only pre-template helper rows are excluded explicitly, not
  // just by the absence of a listingId: rows written before helpers became
  // listing-less may still carry one, and those must never inflate a
  // listing's total.
  const annotationCountByListingId = useMemo(() => {
    if (!allAnnotations) return {};
    return allAnnotations.reduce((acc, a) => {
      if (a.listingId && !isLegacyStyleRevolutionHelper(a))
        acc[a.listingId] = (acc[a.listingId] || 0) + 1;
      return acc;
    }, {});
  }, [allAnnotations]);

  // SCOPE module "Fonds de plan" rows: counts narrowed like the legend.
  const scopeCountByBaseMapId = useMemo(() => {
    if (!isScopeModule || !allAnnotations) return null;
    return allAnnotations.reduce((acc, a) => {
      if (a.baseMapId && !isLegacyStyleRevolutionHelper(a))
        acc[a.baseMapId] = (acc[a.baseMapId] || 0) + 1;
      return acc;
    }, {});
  }, [isScopeModule, allAnnotations]);

  const annotationsByListingId = useMemo(() => {
    if (!allAnnotations) return {};
    return allAnnotations.reduce((acc, a) => {
      if (a.listingId && !isLegacyStyleRevolutionHelper(a)) {
        if (!acc[a.listingId]) acc[a.listingId] = [];
        acc[a.listingId].push(a);
      }
      return acc;
    }, {});
  }, [allAnnotations]);

  const propertiesS = "Propriétés";

  const titleS =
    isBusinessObjectsModule && activeBusinessObject
      ? activeBusinessObject.label
      : isBaseMapsListOnly
        ? "Fonds de plan"
        : "Annotations";

  // Header toggle "Annotations | Fonds de plan" (ToggleContentMode) — plus a
  // "Photos" side in the Viewer module when the project has photos, which
  // swaps the body for the photo albums (2-column grids, click = select the
  // photo). The "Fonds de plan" side swaps the body for the base maps list.
  // Locate-business-object mode keeps the object's label as a plain title.
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const projectPhotos = useProjectPhotos({
    projectId: isViewerModule ? projectId : null,
  });
  const popperContentMode = useSelector(
    (s) => s.popperMapListings.viewerContentMode
  );
  // "Détacher la liste": the base maps list lives in its own popper
  // (PopperBaseMapsList, mounted next to this one by the editors) — this one
  // loses its "Fonds de plan" side. The toggle goes altogether when no
  // second side remains. (The drawing / base map placement commands live in
  // the unified commands toolbar, Features/commandsToolbar.)
  const baseMapsListDetached = useSelector(
    (s) => s.popperMapListings.baseMapsListDetached
  );
  const showPhotosToggle = isViewerModule && projectPhotos.length > 0;
  // "Objets" side (business-objects modules, far left of the toggle,
  // labelled after the module): the module's listings and objects tree.
  const moduleTypeKey = getBusinessObjectTypeKeyFromModuleKey(viewerKey);
  const objectsLabel = useBusinessObjectsModuleLabel(
    moduleTypeKey ?? undefined
  );
  const showObjectsToggle = isBusinessObjectsModule && Boolean(moduleTypeKey);
  const showContentToggle =
    !isLocateBusinessObjectMode &&
    !isBaseMapsListOnly &&
    (!baseMapsListDetached ||
      showPhotosToggle ||
      showObjectsToggle ||
      isScopeModule);
  const showObjectsBody =
    showObjectsToggle && showContentToggle && popperContentMode === "OBJECTS";
  const showScopeContentBody =
    isScopeModule && showContentToggle && popperContentMode === "CONTENT";
  const showPhotosBody = showPhotosToggle && popperContentMode === "PHOTOS";
  const showBaseMapsBody =
    isBaseMapsListOnly ||
    (showContentToggle &&
      !baseMapsListDetached &&
      popperContentMode === "BASE_MAPS");
  // Annotations side (the standard body): no other side displayed.
  const showStandardBody =
    !collapsed &&
    !showBaseMapsBody &&
    !showScopeContentBody &&
    !showObjectsBody;
  // Side title row with the properties button: not in the Viewer / SCOPE
  // modules nor the BaseMaps module (read-only legends, no popper properties
  // there).
  const showSideProperties =
    !isBaseMapsViewer && !isViewerModule && !isScopeModule;

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  // state

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const comesFromListing = viewerReturnContext?.fromViewer === "SCOPE";

  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({ paperRef });

  // Height of the frame the popper lives in (the editor box, see
  // PortalEditorFloatingPanels): the layers section below is capped at 45%
  // of the popper's maximum height. A CSS "45%" would not do: the Paper has
  // no explicit height (maxHeight only, or "auto" height), so a percentage
  // maxHeight on its children resolves to none, and a long layers list
  // pushed the listing selector, the templates and the footer out of the
  // (overflow hidden) Paper with no way to scroll.
  const showsPaper = !(
    !isThreedViewer &&
    !isBaseMapsLegendThreed &&
    (pasteClipboard ||
      subtractPickAnnotationId ||
      Boolean(enabledDrawingMode) ||
      activeThreedTool)
  );
  const [frameHeight, setFrameHeight] = useState(0);
  useEffect(() => {
    const frameEl = paperRef.current?.parentElement;
    if (!showsPaper || !frameEl || typeof ResizeObserver === "undefined")
      return;
    const measure = () => setFrameHeight(frameEl.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [showsPaper]);
  const layersMaxHeight = useMemo(() => {
    const base =
      typeof size?.height === "number"
        ? size.height
        : frameHeight - 130 - (isAutoHeight ? position.y : 0);
    return base > 0 ? Math.round(base * 0.45) : undefined;
  }, [size, frameHeight, isAutoHeight, position.y]);

  // helpers - filter listings when coming from LISTING viewer

  const returnListingId = viewerReturnContext?.listingId;
  // Listings in the selector's rank order.
  const visibleListings = listings ?? [];

  // In effective SELECT contexts (2D Selection, 3D, Maillage, ?mode=viewer) the
  // panel acts as a legend: hide listings/templates that have no annotation on
  // the displayed base maps (main + the 3D extra base maps). The template eye
  // does NOT remove rows — eye-hidden templates stay listed (greyed) so they
  // can be re-enabled. In 3D, masking the main base map's annotations (chip
  // toggle) removes its annotations from the legend scope.
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const legendAnnotations = useMemo(() => {
    let arr = allAnnotationsInclHidden ?? [];
    if (mirrors3dFilters && hideMainAnnotationsIn3d)
      arr = arr.filter((a) => a.baseMapId !== baseMap?.id);
    if (scopeAnnotationIdSet)
      arr = arr.filter((a) => scopeAnnotationIdSet.has(a.id));
    return arr;
  }, [
    allAnnotationsInclHidden,
    mirrors3dFilters,
    hideMainAnnotationsIn3d,
    baseMap?.id,
    scopeAnnotationIdSet,
  ]);

  // Parts painted in 3D (« Pinceau ») — same scope as the annotations above
  // (painting template / listing tested, host layer followed). Eye-hidden
  // templates are kept for the legend sets, like allAnnotationsInclHidden.
  const painted = usePaintedPartsQties({
    enabled:
      viewerKey === "MAP" ||
      isBaseMapsLegendAll ||
      viewerKey === "ZONES" ||
      isBusinessObjectsModuleKey(viewerKey) ||
      isPovViewer ||
      isThreedViewer,
    filterByMainBaseMap: !isAllScope,
    filterBySelectedScope: true,
    keepHiddenTemplates: true,
    annotationTemplates,
    ...(mirrors3dFilters
      ? {
          extraBaseMapIds,
          excludeProfileTemplates: true,
          excludeListingsIds: hiddenListingsIds,
          excludeBaseMapIds:
            hideMainAnnotationsIn3d && baseMap?.id ? [baseMap.id] : null,
        }
      : {}),
  });

  // Quantities of the rows: visible templates only, like allAnnotations.
  const paintedQtiesByTemplateId = useMemo(() => {
    const entries = Object.entries(painted.qtiesByTemplateId ?? {}).filter(
      ([templateId]) => !annotationTemplateById?.[templateId]?.hidden
    );
    return entries.length ? Object.fromEntries(entries) : null;
  }, [painted, annotationTemplateById]);

  // Listing counters: annotations + counted painted parts.
  const listingCountsById = useMemo(() => {
    const paintedCounts = Object.entries(painted.countsByListingId ?? {});
    if (!paintedCounts.length) return annotationCountByListingId;
    const counts = { ...annotationCountByListingId };
    paintedCounts.forEach(([listingId, n]) => {
      counts[listingId] = (counts[listingId] ?? 0) + n;
    });
    return counts;
  }, [annotationCountByListingId, painted]);

  const isSelectFilter = effectiveInteractionMode === "SELECT";
  // Maillage module: COTE templates are drawing entries there (see the
  // forceDrawMode rows), so they escape the legend filter — their row must be
  // reachable before any cote exists, and so must their listing.
  const isMeshesModule = viewerKey === "MESHES";
  const coteTemplates = useMemo(
    () =>
      isMeshesModule
        ? (annotationTemplates ?? []).filter(
            (t) => resolveDrawingShape(t) === "COTE"
          )
        : [],
    [isMeshesModule, annotationTemplates]
  );
  const visibleTemplateIds = useMemo(
    () =>
      isSelectFilter
        ? new Set([
            ...legendAnnotations
              .filter((a) => a.annotationTemplateId)
              .map((a) => a.annotationTemplateId),
            ...coteTemplates.map((t) => t.id),
            ...painted.templateIds,
          ])
        : null,
    [isSelectFilter, legendAnnotations, coteTemplates, painted]
  );
  const visibleListingIds = useMemo(
    () =>
      isSelectFilter
        ? new Set([
            ...legendAnnotations.map((a) => a.listingId).filter(Boolean),
            ...coteTemplates.map((t) => t.listingId).filter(Boolean),
            ...painted.listingIds,
          ])
        : null,
    [isSelectFilter, legendAnnotations, coteTemplates, painted]
  );

  const scopedListings = visibleListingIds
    ? visibleListings?.filter((l) => visibleListingIds.has(l.id))
    : visibleListings;
  // Opened from the SCOPE recap with a listing selected: narrow to it, only
  // while that listing is the selected one — creating a listing from the "+"
  // avatar selects the new one, which must then show. A returnListingId that
  // matches nothing here (stale context from another scope, deleted listing)
  // must not empty the panel: ignore the narrowing.
  const returnListing =
    comesFromListing &&
    returnListingId &&
    (!selectedListingId || selectedListingId === returnListingId)
      ? scopedListings?.find((l) => l.id === returnListingId)
      : null;
  // SCOPE module with an annotation listing picked on the "Contenu" side:
  // the legend narrows to it (the grid draws that listing only, see
  // useScopeGridAnnotationsFilter); "Afficher toutes les listes" shows all.
  const scopeFilterListing =
    isScopeGridOpen && scopeListing?.entityModel?.type === "LOCATED_ENTITY"
      ? scopedListings?.find((l) => l.id === scopeListing.id)
      : null;
  const displayedListings = returnListing
    ? [returnListing]
    : scopeFilterListing
      ? [scopeFilterListing]
      : scopedListings;
  // No listing yet → the "+ Liste" chip becomes the main CTA (contained, orange).
  const hasNoListing = !displayedListings?.length;
  const canAddListing = !isBaseMapsViewer && !isThreedViewer;

  // The single "current" listing shown (band + templates) below the chips bar.
  // Falls back to the first chip when nothing is selected or the selection is
  // filtered out (e.g. SELECT / legend mode).
  const activeListing =
    displayedListings?.find((l) => l.id === selectedListingId) ??
    displayedListings?.[0] ??
    null;

  // effect - ESC clears the EDIT target template

  useEffect(() => {
    if (effectiveInteractionMode !== "EDIT") return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
        dispatch(setSelectedItem(null));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effectiveInteractionMode, selectedItem?.type, dispatch]);

  // handlers

  const handleExitSolo = () => {
    dispatch(setSoloAnnotationTemplateId(null));
    dispatch(setSoloRevolutionAxisId(null));
  };

  // A chip click just sets the current listing (persisted via setInitListingId
  // in the slice). Opening the listing properties stays an explicit action (the
  // Tune button on the selected-listing band below).
  // Only used by the commented ListingChipsBar call site (chip selector).
  // eslint-disable-next-line no-unused-vars
  function handleSelectListing(listingId) {
    dispatch(setSelectedListingId(listingId));
  }

  // Chip eye: toggle every template eye of the listing in one dispatch
  // (same rule as the listing-row eye).
  // Only used by the commented ListingChipsBar call site (chip selector).
  // eslint-disable-next-line no-unused-vars
  function handleToggleListingVisibility(listingId) {
    const templates = templatesByListingId[listingId] ?? [];
    dispatch(
      setAnnotationTemplatesHidden({
        ids: templates.map((t) => t.id),
        hidden: !hiddenByListingId[listingId],
      })
    );
  }

  // render

  // Helper chain of the drawing modules (Dessin in 2D and in its 3D editor):
  // off in the 3D-family modules (Viewer, Maillage) and in the BaseMaps
  // module displaying its 3D editor.
  const helpersEnabled = !isThreedViewer && !isBaseMapsLegendThreed;

  if (helpersEnabled && pasteClipboard) {
    return <PopperPasteHelper />;
  }

  if (helpersEnabled && subtractPickAnnotationId) {
    return <PopperSubtractHelper />;
  }

  // An armed draw, or a threedEditor tool armed from « Outils de dessin »
  // (Extruder / Déplacer / Tourner in the Dessin module's 3D editor).
  if (helpersEnabled && (Boolean(enabledDrawingMode) || activeThreedTool)) {
    return <PopperDrawingHelper />;
  }

  // in BASE_MAPS viewer, mounting is gated by the folded left panel (legend,
  // see MainMapEditorV3)

  // Default geometry: the whole available height — until the user resizes
  // (explicit width / height, reset on a double-click of the handle).
  const defaultMaxHeight = "calc(100% - 130px)";

  return (
    <Paper
      ref={paperRef}
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 50,
        left: 50,
        zIndex: 10,
        width: size?.width ?? 320,
        ...(size && !collapsed
          ? {
              height: size.height,
              // "auto" height: the bottom stays above the bottom reserve.
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({ top: "50px", offsetY: position.y })
                : "calc(100% - 50px)",
            }
          : { maxHeight: defaultMaxHeight }),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "panel.border",
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Draggable header (whole bar except action buttons on the right) */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 0.25,
          pr: 1,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderBottom: collapsed ? "none" : "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <DragIndicatorIcon
            fontSize="small"
            sx={{ color: "panel.textLight" }}
          />
        </Box>

        {showContentToggle ? (
          <ToggleContentMode
            showObjects={showObjectsToggle}
            objectsLabel={objectsLabel}
            showContent={isScopeModule}
            showPhotos={showPhotosToggle}
            showBaseMaps={!baseMapsListDetached}
            annotationsLabel="Annotations"
          />
        ) : (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
          >
            {titleS}
          </Typography>
        )}

        {/* Properties of the displayed side (annotations / base maps sides).
            Hidden in the Viewer module and the BaseMaps module (read-only
            legends, no popper properties there). On the commandes side the
            button is kept in the layout, invisible, so the header does not
            jump between sides. */}
        {showSideProperties && (
          <Tooltip title={propertiesS} arrow placement="top">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dispatch(
                  setSelectedItem({
                    id: selectedScopeId,
                    type: showBaseMapsBody
                      ? "POPPER_BASE_MAPS"
                      : "POPPER_MAP_LISTINGS",
                  })
                );
                dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
              }}
              sx={{
                color: "panel.textLight",
                p: 0.25,
                cursor: "pointer",
                visibility: showObjectsBody ? "hidden" : "visible",
                pointerEvents: showObjectsBody ? "none" : "auto",
              }}
            >
              <Tune sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* BaseMaps module, "Fonds de plan" side: new folder. */}
        {isBaseMapsViewer && showBaseMapsBody && (
          <IconButtonCreateBaseMapListing />
        )}
      </Box>

      {/* BaseMaps module: "Afficher les annotations" switch (same state as
          the left panel's), right under the header on both sides. Turning it
          on from the list-only popper keeps the user on the base maps list. */}
      {!collapsed && isBaseMapsViewer && (
        <Box
          sx={{
            flexShrink: 0,
            px: 1,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <SwitchGeneric
            label={showAnnotationsS}
            checked={showAnnotationsInBaseMaps}
            onChange={(checked) => {
              if (checked && isBaseMapsListOnly && !baseMapsListDetached)
                dispatch(setViewerContentMode("BASE_MAPS"));
              dispatch(setShowAnnotations(checked));
            }}
          />
        </Box>
      )}

      {/* SCOPE module filter band, under the header on every side: the
          listing picked on the "Contenu" side narrows the grid and the
          legend — the cross goes back to "Afficher toutes les listes". */}
      {isScopeGridOpen && scopeListing && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            pl: 1.5,
            pr: 0.5,
            py: 0.25,
            flexShrink: 0,
            bgcolor: "secondary.main",
            color: "secondary.contrastText",
          }}
        >
          <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }}>
            <b>{scopeFilterS}</b> {scopeListing.name}
          </Typography>
          <Tooltip title={exitScopeFilterS} arrow placement="top">
            <IconButton
              size="small"
              onClick={() => {
                dispatch(setScopeModuleShowAllListings(true));
                dispatch(setSelectedItem(null));
              }}
              sx={{ color: "inherit", p: 0.25 }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* "Objets" side (business-objects modules): the module's listings and
          objects tree replace the whole body. */}
      {!collapsed && showObjectsBody && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          <SectionPopperBusinessObjects typeKey={moduleTypeKey} />
        </Box>
      )}

      {/* "Contenu" side (SCOPE module): the scope content replaces the whole
          body — every listing of the scope, grouped by family. */}
      {!collapsed && showScopeContentBody && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SectionPopperScopeContent />
        </Box>
      )}

      {/* "Fonds de plan" side: the base maps list replaces the whole body. */}
      {!collapsed && showBaseMapsBody && (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SectionBaseMapsList
            countByBaseMapIdOverride={scopeCountByBaseMapId}
          />
        </Box>
      )}

      {showStandardBody && (
        <>
          {/* Interaction mode toggle (DRAW / EDIT / SELECT) — advanced mode
              only; hidden in 3D and viewer mode (read-only) */}
          {/* Standard body (layers / listings / cut tools) */}

          {/* Layers — pinned right under the header, above the listing
              selector. Capped in height so a long layers list never pushes
              the listing selector / templates out of sight. */}
          {viewerKey === "MAP" && showLayers && (
            <Box
              sx={{
                flexShrink: 0,
                maxHeight: layersMaxHeight,
                overflow: "auto",
              }}
            >
              <SectionLayers baseMapId={baseMap?.id} />
            </Box>
          )}

          {/* Warning: base map has no scale */}
          {baseMap && !baseMap.meterByPx && !isLegendPopper && (
            <WarningBaseMapNotToScale />
          )}

          {/* Active listing block — the "Liste active" band (name, "..."
            menu, count / visibility pill) and, below it, the expandable
            listings panel ("Listes" header: select, show / hide, reorder,
            create, "Visibilité auto" in its "..." menu). Shown whenever there are
            listings, or when a new one can be created (empty-state CTA of
            the LISTE ACTIVE field). Hidden in the legend poppers (Viewer
            module, BaseMaps module), where every listing is shown at once.
            Kept out of the scrollable body so it stays in sight while the
            templates scroll. */}
          {!isLegendPopper &&
            !isLocateBusinessObjectMode &&
            (displayedListings?.length > 0 || canAddListing) && (
              <Box
                sx={{
                  flexShrink: 0,
                  borderBottom: "1px solid",
                  borderColor: "panel.border",
                }}
              >
                {hasNoListing ? (
                  <FieldActiveListing
                    listings={displayedListings}
                    activeListing={activeListing}
                    countsByListingId={listingCountsById}
                    showAddListing={canAddListing}
                  />
                ) : (
                  <BandActiveListing
                    listings={displayedListings}
                    activeListing={activeListing}
                    countsByListingId={listingCountsById}
                    showAddListing={canAddListing}
                  />
                )}
              </Box>
            )}

          {/* Scrollable body: templates of the active listing */}
          <Box sx={{ overflow: "auto", flex: 1 }}>
            {/* Nouvelle zone (ZONES module) — dedicated section showing the zone
            selected in the drawer as a DRAW-armed template row: this is the
            only drawing entry of the module (the listings below are a
            read-only legend). */}
            {isZonesViewer && selectedZoneTemplate && (
              <Box
                sx={{
                  borderBottom: "1px solid",
                  borderColor: "panel.border",
                }}
              >
                {/* Same typography as the listing section headers below. */}
                <Box sx={{ px: 1, py: 0.75, bgcolor: "secondary.main" }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "secondary.contrastText" }}
                  >
                    Nouvelle zone
                  </Typography>
                </Box>
                <List dense disablePadding>
                  <AnnotationTemplateRow
                    annotationTemplate={selectedZoneTemplate}
                    listingId={selectedZoneTemplate.listingId}
                    count={selectedZoneAnnotationsCount}
                    spriteImage={spriteImage}
                    forceDrawMode
                  />
                </List>
              </Box>
            )}

            {/* Former chips-based selector (ListingChipsBar) — kept below,
            commented, in case the chip version needs to be reactivated:
            {!isViewerModule &&
              (displayedListings?.length > 0 || canAddListing) && (
                <ListingChipsBar
                  listings={displayedListings}
                  activeListingId={activeListing?.id}
                  annotationCountByListingId={annotationCountByListingId}
                  hiddenByListingId={hiddenByListingId}
                  onSelectListing={handleSelectListing}
                  onToggleListingVisibility={handleToggleListingVisibility}
                  showAddButton={canAddListing}
                  hasNoListing={hasNoListing}
                  onAddListing={() => setOpenCreateListing(true)}
                  addLabel={addListS}
                />
              )}
            */}

            {/* Viewer module, Photos side of the header toggle: photo albums
                (2-column grids) replace the annotations legend. */}
            {showPhotosBody && <SectionPopperPhotos />}

            {/* Viewer 2D: the legend is scoped to the current baseMap — make
                the empty case explicit instead of a blank panel. */}
            {!showPhotosBody &&
              (isViewer2d || isBaseMapsLegend) &&
              hasNoListing && (
                <Box sx={{ px: 1.5, py: 1.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "panel.textMuted", fontStyle: "italic" }}
                  >
                    Aucune annotation pour ce fond de plan
                  </Typography>
                </Box>
              )}

            <>
              {/* Viewer module: full legend — every listing at once (no chips
                  selector), each row always expanded with its templates. The
                  row's hover eye toggles all the listing's template eyes. */}
              {isLocateBusinessObjectMode && (
                <Box sx={{ pt: 0.5 }}>
                  <AnnotationTemplatesForListing
                    listingId={activeBusinessObject.listingId}
                    annotations={
                      annotationsByListingId?.[activeBusinessObject.listingId]
                    }
                    annotationTemplateById={annotationTemplateById}
                    paintedQtiesByTemplateId={paintedQtiesByTemplateId}
                    templateDefaults={{ isBusinessObjectAnnotation: true }}
                  />
                </Box>
              )}
              {isLocateBusinessObjectMode
                ? null
                : isLegendPopper
                  ? !showPhotosBody &&
                    displayedListings?.map((listing) => (
                      <ListingRow
                        key={listing.id}
                        listing={listing}
                        isExpanded
                        alwaysExpanded
                        hideCaret
                        annotationCount={listingCountsById?.[listing.id] || 0}
                        annotations={annotationsByListingId?.[listing.id]}
                        annotationTemplateById={annotationTemplateById}
                        paintedQtiesByTemplateId={paintedQtiesByTemplateId}
                        visibleTemplateIds={visibleTemplateIds}
                      />
                    ))
                  : activeListing && (
                      <ListingRow
                        key={activeListing.id}
                        listing={activeListing}
                        isExpanded
                        alwaysExpanded
                        hideCaret
                        // The selector above already names the listing.
                        hideHeader
                        annotationCount={
                          listingCountsById?.[activeListing.id] || 0
                        }
                        annotations={annotationsByListingId?.[activeListing.id]}
                        annotationTemplateById={annotationTemplateById}
                        paintedQtiesByTemplateId={paintedQtiesByTemplateId}
                        visibleTemplateIds={visibleTemplateIds}
                      />
                    )}

              {/* Coupes / élévations liées — on a VERTICAL base map targeted
                by BASE_MAP_LINK marks: one row per link to draw its clone
                here (the clone poses this base map in 3D). */}
              {!isLocateBusinessObjectMode && (
                <SectionBaseMapLinkClones
                  baseMap={baseMap}
                  annotationTemplateById={annotationTemplateById}
                  spriteImage={spriteImage}
                />
              )}
            </>
          </Box>

          {/* Pinned bottom section — outside the scrollable body, so it
              stays in sight while the templates scroll. Capped in height so
              it never hides the templates.
              - « Annotations sans modèle » (Dessin popper, scope-level: the
                « Dessin » command needs no listing), hidden in 3D and while
                SELECT-filtering;
              - Axes de révolution, as soon as the base map carries one
                (drawn on this plan / placed on this vertical base map): one
                row per axis, without section header, with the navigation to
                the perpendicular base map, the eye / solo of everything
                linked to it and its 3D half-view. */}
          {!isBaseMapsLegend && !isLocateBusinessObjectMode && (
            <Box
              sx={{
                flexShrink: 0,
                maxHeight: layersMaxHeight,
                overflow: "auto",
              }}
            >
              {isDessinPopper &&
                !isLegendPopper &&
                !isThreedViewer &&
                !visibleTemplateIds && (
                  <Box
                    sx={{ borderTop: "1px solid", borderColor: "panel.border" }}
                  >
                    <RowTemplatelessAnnotations
                      annotations={templatelessAnnotations}
                    />
                  </Box>
                )}
              <SectionRevolutionAxes
                baseMap={baseMap}
                spriteImage={spriteImage}
                hideHeader
              />
            </Box>
          )}
        </>
      )}

      {/* Template SOLO band — outside the scrollable body, so it stays visible
          at the bottom (collapsed panel included). */}
      {(soloTemplateId || soloRevolutionAxisId) &&
        !showBaseMapsBody &&
        !showScopeContentBody &&
        !showObjectsBody && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              pl: 1.5,
              pr: 0.5,
              py: 0.25,
              flexShrink: 0,
              bgcolor: "secondary.main",
              color: "secondary.contrastText",
            }}
          >
            <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }}>
              <b>{soloS}</b>{" "}
              {[soloTemplate?.label, soloRevolutionAxis?.label]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
            <Tooltip title={exitSoloS} arrow placement="top">
              <IconButton
                size="small"
                onClick={handleExitSolo}
                sx={{ color: "inherit", p: 0.25 }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

      {/* Bottom band (collapsed included): the Dessin "Fond de plan
          sélectionné seul" switch at the far left, "auto" height, detach icon
          of the base maps / commandes sides, collapse / expand toggle, resize
          handle in its reserved right margin. */}
      <PanelFooter
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
        collapsed={collapsed}
        onToggleCollapsed={() => dispatch(setCollapsed(!collapsed))}
      >
        {showBaseMapsBody && !isBaseMapsListOnly && (
          <IconButtonToggleDetached />
        )}
      </PanelFooter>
    </Paper>
  );
}
