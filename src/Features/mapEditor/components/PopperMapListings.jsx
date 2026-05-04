import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
import { generateKeyBetween } from "fractional-indexing";

import {
  setSelectedListingId,
  setHiddenListingsIds,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Button,
  Paper,
  Typography,
  List,
  ListItemButton,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Switch,
  FormControlLabel,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Add from "@mui/icons-material/Add";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Tune from "@mui/icons-material/Tune";
import FilterAlt from "@mui/icons-material/FilterAlt";
import FormatColorFill from "@mui/icons-material/FormatColorFill";
import UnfoldLess from "@mui/icons-material/UnfoldLess";
import UnfoldMore from "@mui/icons-material/UnfoldMore";
import { Check, Close } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { StopCircle, Create } from "@mui/icons-material";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import IconCutLine from "Features/icons/IconCutLine";
import IconCutSurface from "Features/icons/IconCutSurface";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import CardLoupe from "Features/smartDetect/components/CardLoupe";
import CardSmartDetect from "Features/smartDetect/components/CardSmartDetect";
import SectionSurfaceDropOptions from "Features/smartDetect/components/SectionSurfaceDropOptions";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import getEffectiveDetectionMode from "Features/mapEditor/utils/getEffectiveDetectionMode";
import SectionSegmentLength from "Features/annotations/components/SectionSegmentLength";
import SectionLayers from "Features/layers/components/SectionLayers";
import {
  setShowLayers,
  setSoloVisibleTemplateIds,
  setSoloListingId,
  setSoloMode,
  setInteractionMode,
  setCollapsed,
} from "Features/popperMapListings/popperMapListingsSlice";
import DrawIcon from "@mui/icons-material/Draw";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import IconPointer from "Features/icons/IconPointer";
import useLayers from "Features/layers/hooks/useLayers";
import { alpha } from "@mui/material/styles";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
  setAutoMergeOnCommit,
} from "Features/mapEditor/mapEditorSlice";
import WarningAmber from "@mui/icons-material/WarningAmber";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import useReplaceVersionImage from "Features/baseMaps/hooks/useReplaceVersionImage";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionCompareTwoImages from "Features/baseMapTransforms/components/SectionCompareTwoImages";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import ButtonMergeListingAnnotations from "Features/baseMapEditor/components/ButtonMergeListingAnnotations";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  getDrawingToolsByType,
  getDrawingToolsByShape,
  getDrawingToolByKey,
} from "Features/mapEditor/constants/drawingTools.jsx";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import useListings from "Features/listings/hooks/useListings";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// ---------------------------------------------------------------------------
// TOOL_ITEMS — static tool definitions for the "Outils" section
// ---------------------------------------------------------------------------

const TOOL_ITEMS = [
  { type: "CUT", label: "Ouverture", Icon: StopCircle },
  { type: "SPLIT_LINE", label: "Couper une ligne", Icon: IconCutLine },
  { type: "SPLIT_SURFACE", label: "Couper des surfaces", Icon: IconCutSurface },
  { type: "TECHNICAL_RETURN", label: "Retour 1m", Icon: IconTechnicalReturn },
  { type: "COMPLETE_ANNOTATION", label: "Prolonger", Icon: Create },
];

// ---------------------------------------------------------------------------
// ToolRow — one cut/split tool with click-to-draw + tool picker menu
// ---------------------------------------------------------------------------

function ToolRow({ type, label, Icon }) {
  const dispatch = useDispatch();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[type]
  );

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);

  // helpers

  const tools = getDrawingToolsByType(type);
  const activeTool = selectedToolKey
    ? tools.find((t) => t.key === selectedToolKey) ?? tools[0]
    : tools[0];
  const ActiveToolIcon = activeTool?.Icon;

  // handlers

  const handleRowClick = () => {
    if (!activeTool) return;
    dispatch(setEnabledDrawingMode(activeTool.key));
    dispatch(
      setNewAnnotation({ ...newAnnotation, type: activeTool.annotationType })
    );
  };

  const handleToolBtnClick = (e) => {
    e.stopPropagation();
    setToolMenuAnchor(e.currentTarget);
  };

  const handleSelectTool = (tool) => {
    dispatch(
      setSelectedToolKeyForTemplate({ templateId: type, toolKey: tool.key })
    );
    dispatch(setEnabledDrawingMode(tool.key));
    dispatch(setNewAnnotation({ ...newAnnotation, type: tool.annotationType }));
  };

  const handleMenuClose = () => {
    setToolMenuAnchor(null);
    setIsHovered(false);
  };

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { if (!toolMenuAnchor) setIsHovered(false); }}
        sx={{
          position: "relative",
          bgcolor: "white",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 3,
          pr: 1,
          py: 0.5,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              mr: 1,
            }}
          >
            <Icon sx={{ fontSize: 18, color: isHovered ? "panel.textSecondary" : "panel.textMuted" }} />
          </Box>
          <Typography variant="body2" sx={{ color: "panel.textSecondary", userSelect: "none" }}>
            {label}
          </Typography>
        </Box>

        {/* Right side: active tool icon on hover */}
        {isHovered && ActiveToolIcon && (
          <Tooltip title="Changer d'outil" arrow>
            <IconButton
              size="small"
              onClick={handleToolBtnClick}
              sx={{
                p: 0.5,
                bgcolor: Boolean(toolMenuAnchor) ? "panel.textMuted" : "action.hover",
                color: Boolean(toolMenuAnchor) ? "white" : "panel.textMuted",
                borderRadius: 1,
                "&:hover": {
                  bgcolor: "panel.textMuted",
                  color: "white",
                },
              }}
            >
              <ActiveToolIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </ListItemButton>

      {/* Tool picker menu */}
      <Menu
        anchorEl={toolMenuAnchor}
        open={Boolean(toolMenuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "panel.border" }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "panel.textPrimary" }}>
            {label}
          </Typography>
        </Box>
        {tools.map((tool) => (
          <MenuItem
            key={tool.key}
            onClick={() => { handleSelectTool(tool); handleMenuClose(); }}
            sx={{ gap: 1, py: 0.75, fontSize: "0.8125rem" }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <tool.Icon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {tool.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ToolPickerMenu — menu to select a drawing tool for an annotation template
// ---------------------------------------------------------------------------

function ToolPickerMenu({
  anchorEl,
  open,
  onClose,
  annotationTemplate,
  onSelectTool,
  onEdit,
}) {
  // helpers

  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape);

  // render

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: {
            minWidth: 200,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "panel.border",
            mt: 0.5,
          },
        },
      }}
    >
      {/* Template name header */}
      <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "panel.border" }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: "panel.textPrimary",
          }}
        >
          {annotationTemplate?.label}
        </Typography>
      </Box>

      {/* Tool options */}
      {tools.map((tool) => (
        <MenuItem
          key={tool.key}
          onClick={() => {
            onSelectTool(tool);
            onClose();
          }}
          sx={{ gap: 1, py: 0.75, fontSize: "0.8125rem" }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <tool.Icon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: "body2" }}>
            {tool.label}
          </ListItemText>
        </MenuItem>
      ))}

      <Divider />

      {/* Edit template button */}
      <MenuItem
        onClick={() => {
          onEdit();
          onClose();
        }}
        sx={{ gap: 1, py: 0.75, color: "panel.textMuted" }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          <SettingsOutlined sx={{ fontSize: 18, color: "panel.textMuted" }} />
        </ListItemIcon>
        <ListItemText primaryTypographyProps={{ variant: "body2", color: "panel.textMuted" }}>
          Éditer le modèle
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}

// ---------------------------------------------------------------------------
// SortableAnnotationTemplateRow — wrapper for DnD
// ---------------------------------------------------------------------------

function SortableAnnotationTemplateRow(props) {
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
    <AnnotationTemplateRow
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
  onSoloToggle,
}) {
  const dispatch = useDispatch();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);
  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[annotationTemplate?.id]
  );
  const soloMode = useSelector((s) => s.popperMapListings.soloMode);
  const soloVisibleTemplateIds = useSelector(
    (s) => s.popperMapListings.soloVisibleTemplateIds
  );
  const soloListingId = useSelector((s) => s.popperMapListings.soloListingId);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const selectedItem = useSelector((s) => s.selection.selectedItems[0] || null);
  const isEditTarget =
    (interactionMode === "EDIT" || interactionMode === "SELECT") &&
    selectedItem?.type === "ANNOTATION_TEMPLATE" &&
    selectedItem.id === annotationTemplate?.id;

  // helpers

  const isHiddenByBase = annotationTemplate?.hidden;
  const isHiddenBySolo =
    soloMode &&
    soloVisibleTemplateIds != null &&
    soloListingId === listingId &&
    !soloVisibleTemplateIds.includes(annotationTemplate?.id);
  const isHidden = isHiddenBySolo || isHiddenByBase;
  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape);
  const fallbackTool = annotationTemplate?.defaultTool
    ? getDrawingToolByKey(annotationTemplate.defaultTool) ?? tools[0]
    : tools[0];
  const activeTool = selectedToolKey
    ? getDrawingToolByKey(selectedToolKey) ?? fallbackTool
    : fallbackTool;
  const ActiveToolIcon = activeTool?.Icon;

  // handlers

  const handleStartDraw = () => {
    if (isEditing || !activeTool) return;
    dispatch(setSelectedListingId(listingId));
    const baseProps = getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);
    if (activeTool.annotationType) {
      dispatch(setNewAnnotation({ ...baseProps, type: activeTool.annotationType }));
    } else {
      dispatch(setNewAnnotation(baseProps));
    }
    dispatch(setEnabledDrawingMode(activeTool.key));
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
    switch (interactionMode) {
      case "EDIT":
      case "SELECT":
        handleEditTemplate();
        return;
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
    setToolMenuAnchor(e.currentTarget);
  };

  const handleSelectTool = (tool) => {
    dispatch(setSelectedToolKeyForTemplate({ templateId: annotationTemplate?.id, toolKey: tool.key }));
    // Activate drawing with this tool
    dispatch(setSelectedListingId(listingId));
    const baseProps = getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);
    if (tool.annotationType) {
      dispatch(setNewAnnotation({ ...baseProps, type: tool.annotationType }));
    } else {
      dispatch(setNewAnnotation(baseProps));
    }
    dispatch(setEnabledDrawingMode(tool.key));
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

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden,
    });
  };

  const handleSoloClick = (e) => {
    e.stopPropagation();
    onSoloToggle?.(annotationTemplate?.id, listingId);
  };

  const isSoloActive =
    soloMode &&
    soloListingId === listingId &&
    soloVisibleTemplateIds?.length === 1 &&
    soloVisibleTemplateIds[0] === annotationTemplate?.id;

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
    <Box ref={sortableRef} style={sortableStyle} {...(sortableAttributes ?? {})}>
      <ListItemButton
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { if (!toolMenuAnchor) setIsHovered(false); }}
        sx={{
          position: "relative",
          bgcolor: isEditTarget
            ? alpha(annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "#1976d2", 0.18)
            : "white",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 1,
          pr: 1,
          py: 0.5,
          borderLeft: "3px solid",
          borderColor: isEditTarget
            ? annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "primary.main"
            : isHovered
            ? annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "transparent"
            : "transparent",
          "&:hover": {
            bgcolor: alpha(annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "#999", 0.1),
          },
        }}
      >
        {/* Drag handle */}
        <Box
          {...(dragListeners ?? {})}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            opacity: isHovered ? 1 : 0,
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              mr: 1,
              flexShrink: 0,
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
            }}
          >
            <AnnotationTemplateIcon
              template={annotationTemplate}
              size={18}
              spriteImage={spriteImage}
            />
          </Box>
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
            <Typography
              variant="body2"
              color={isHidden ? "text.disabled" : "panel.textPrimary"}
              sx={{
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "none",
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
          )}
        </Box>

        {/* Right side: edit confirm/cancel OR tool+visibility (hover) OR qty */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
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
          ) : isHovered ? (
            interactionMode === "EDIT" ? (
              /* EDIT mode — reassign-template (paint bucket) + visibility */
              <>
                <Tooltip title="Modifier le modèle d'une annotation" arrow placement="bottom">
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
                    <FormatColorFill fontSize="inherit" sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow placement="right">
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={{ p: 0.5, color: isHidden ? "secondary.main" : "panel.iconMuted" }}
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
                {/* Properties + tool buttons hidden in SELECT mode (read-only) */}
                {interactionMode !== "SELECT" && (
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
                      <Tooltip title="Changer d'outil" arrow>
                        <IconButton
                          size="small"
                          onClick={handleToolBtnClick}
                          sx={{
                            p: 0.5,
                            bgcolor: Boolean(toolMenuAnchor)
                              ? annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "grey.500"
                              : alpha(annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "#999", 0.15),
                            color: Boolean(toolMenuAnchor) ? "white" : annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "grey.500",
                            borderRadius: 1,
                            "&:hover": {
                              bgcolor: annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "grey.500",
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
                <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow placement="right">
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={{ p: 0.5, color: isHidden ? "secondary.main" : "panel.iconMuted" }}
                  >
                    {isHidden ? (
                      <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
                {/* Solo button — only in SELECT mode */}
                {interactionMode === "SELECT" && (
                  <Tooltip title="Solo" arrow placement="right">
                    <IconButton
                      size="small"
                      onClick={handleSoloClick}
                      sx={{
                        p: 0.5,
                        color: isSoloActive ? "primary.main" : "panel.iconMuted",
                      }}
                    >
                      <FilterAlt fontSize="inherit" sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )
          ) : (
            <Typography
              align="right"
              noWrap
              sx={{ fontSize: "10px", minWidth: "40px", fontFamily: "monospace", fontWeight: 500 }}
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
          )}
        </Box>
      </ListItemButton>

      {/* Tool picker menu */}
      <ToolPickerMenu
        anchorEl={toolMenuAnchor}
        open={Boolean(toolMenuAnchor)}
        onClose={() => { setToolMenuAnchor(null); setIsHovered(false); }}
        annotationTemplate={annotationTemplate}
        onSelectTool={handleSelectTool}
        onEdit={handleEditTemplate}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AnnotationTemplatesForListing — templates list for one expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplatesForListing({ listingId, annotations, annotationTemplateById }) {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByOrder: true,
  });
  const spriteImage = useAnnotationSpriteImage();
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const soloVisibleTemplateIds = useSelector(
    (s) => s.popperMapListings.soloVisibleTemplateIds
  );

  const qtiesById = useMemo(
    () => computeAnnotationTemplateQties(annotations, annotationTemplateById),
    [annotations, annotationTemplateById]
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

  // handlers - solo mode

  const handleSoloToggle = useCallback(
    (templateId, templateListingId) => {
      const isOnlyVisible =
        soloVisibleTemplateIds != null &&
        soloVisibleTemplateIds.length === 1 &&
        soloVisibleTemplateIds[0] === templateId;
      if (isOnlyVisible) {
        dispatch(setSoloVisibleTemplateIds(null));
        dispatch(setSoloListingId(null));
      } else {
        dispatch(setSoloVisibleTemplateIds([templateId]));
        dispatch(setSoloListingId(templateListingId));
      }
    },
    [dispatch, soloVisibleTemplateIds]
  );

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // dnd sensors

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // dnd handlers

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !annotationTemplates?.length) return;

      const oldIndex = sortableIds.indexOf(active.id);
      const newIndex = sortableIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const normalizeGroup = (g) =>
        (g ?? "").trim().toUpperCase().replace(/\s+/g, "");

      const draggedTemplate = annotationTemplates[oldIndex];
      const overTemplate = annotationTemplates[newIndex];
      const draggedGroup = normalizeGroup(draggedTemplate?.groupLabel);
      const overGroup = normalizeGroup(overTemplate?.groupLabel);

      // Determine if this is a within-group reorder or a cross-group move
      const isWithinGroup = draggedGroup && draggedGroup === overGroup;

      let newOrder;
      if (isWithinGroup) {
        // Within-group: move just the dragged item within the list
        newOrder = [...annotationTemplates];
        newOrder.splice(oldIndex, 1);
        const adjustedNewIndex = newOrder.findIndex((t) => t.id === over.id);
        newOrder.splice(adjustedNewIndex, 0, draggedTemplate);
      } else {
        // Cross-group: move all group members together
        const groupMembers = draggedGroup
          ? annotationTemplates.filter(
              (t) => normalizeGroup(t.groupLabel) === draggedGroup
            )
          : [draggedTemplate];

        const remaining = annotationTemplates.filter(
          (t) => !groupMembers.some((m) => m.id === t.id)
        );

        const overInRemaining = remaining.findIndex((t) => t.id === over.id);
        const insertAt =
          overInRemaining === -1 ? remaining.length : overInRemaining;

        newOrder = [...remaining];
        newOrder.splice(insertAt, 0, ...groupMembers);
      }

      // Assign new orderIndex values using fractional indexing
      let lastIndex = null;
      for (const template of newOrder) {
        const newOrderIndex = generateKeyBetween(lastIndex, null);
        lastIndex = newOrderIndex;
        if (template.orderIndex !== newOrderIndex) {
          await updateAnnotationTemplate({
            ...template,
            orderIndex: newOrderIndex,
          });
        }
      }
    },
    [annotationTemplates, sortableIds, updateAnnotationTemplate]
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
              const templateQties = qtiesById?.[item.id];
              const count = templateQties?.count || 0;
              const qtyLabel = templateQties?.mainQtyLabel;
              return (
                <SortableAnnotationTemplateRow
                  key={item.id}
                  annotationTemplate={item}
                  count={count}
                  qtyLabel={qtyLabel}
                  listingId={listingId}
                  spriteImage={spriteImage}
                  onSoloToggle={handleSoloToggle}
                />
              );
            })}
          </List>
        </SortableContext>
      </DndContext>

      {/* + Nouveau modele */}
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

      {openCreateDialog && (
        <DialogCreateAnnotationTemplate
          open={openCreateDialog}
          onClose={() => setOpenCreateDialog(false)}
          listingId={listingId}
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
  hiddenListingsIds,
  annotationCount,
  annotations,
  annotationTemplateById,
  extraAction,
}) {
  const dispatch = useDispatch();

  // state

  const [isHovered, setIsHovered] = useState(false);
  const soloMode = useSelector((s) => s.popperMapListings.soloMode);
  const soloVisibleTemplateIds = useSelector(
    (s) => s.popperMapListings.soloVisibleTemplateIds
  );
  const soloListingId = useSelector((s) => s.popperMapListings.soloListingId);

  // helpers

  const isHidden = hiddenListingsIds?.includes(listing.id);

  // handlers

  function handleToggleVisibility(e) {
    e.stopPropagation();
    if (soloMode) {
      const listingTemplateIds = Object.values(annotationTemplateById ?? {})
        .filter((t) => t.listingId === listing.id)
        .map((t) => t.id);
      const isAlreadySolo =
        soloListingId === listing.id && soloVisibleTemplateIds != null;
      if (isAlreadySolo) {
        dispatch(setSoloVisibleTemplateIds(null));
        dispatch(setSoloListingId(null));
      } else {
        dispatch(setSoloVisibleTemplateIds(listingTemplateIds));
        dispatch(setSoloListingId(listing.id));
      }
    } else {
      const next = isHidden
        ? hiddenListingsIds.filter((id) => id !== listing.id)
        : [...hiddenListingsIds, listing.id];
      dispatch(setHiddenListingsIds(next));
    }
  }

  function handleListingClick() {
    onToggleExpand(listing.id);
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

  return (
    <Box>
      <Box
        onClick={handleListingClick}
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
          opacity: isHidden ? 0.5 : 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
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
        </Box>

        {extraAction}

        {/* Right side: properties + visibility (hover) / count (default) */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
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
        <Box sx={{ position: "relative", minWidth: 24, height: 24, flexShrink: 0 }}>
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
              color: annotationCount > 0 ? "secondary.main" : "panel.countEmpty",
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

      {isExpanded && (
        <AnnotationTemplatesForListing
          listingId={listing.id}
          annotations={annotations}
          annotationTemplateById={annotationTemplateById}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

// Modes that select existing geometry — no smart detect needed
const SEGMENT_SELECT_MODES = ["TECHNICAL_RETURN", "CUT_SEGMENT", "SPLIT_POLYLINE"];

// Modes that produce segments and support length display / constraint
const SEGMENT_DRAWING_MODES = [
  "CLICK", "POLYLINE_CLICK", "POLYGON_CLICK", "CUT_CLICK", "SPLIT_CLICK",
  "STRIP", "MEASURE", "COMPLETE_ANNOTATION",
];

// Modes where the "Détection auto" card makes sense — the base drawing
// tool has a backing detection algorithm (see getEffectiveDetectionMode).
const SMART_DETECT_CAPABLE_MODES = [
  "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "RECTANGLE",
  "STRIP", "POLYLINE_CLICK", "POLYGON_CLICK",
  "SURFACE_DROP",
];

// Among the smart-capable modes, the ones that expose an H/V orientation
// (the rectangle/surface variants don't — orientation is irrelevant there).
const ORIENTATION_CAPABLE_MODES = ["STRIP", "POLYLINE_CLICK"];

function PopperDrawingHelper() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Mode dessin";

  // data

  const enabledDrawingMode = useSelector(
    (s) => s.mapEditor.enabledDrawingMode
  );
  const smartDetectEnabled = useSelector(
    (s) => s.mapEditor.smartDetectEnabled
  );
  const autoMergeOnCommit = useSelector(
    (s) => s.mapEditor.autoMergeOnCommit
  );
  const isSegmentSelectMode = SEGMENT_SELECT_MODES.includes(enabledDrawingMode);
  const showSegmentLength = SEGMENT_DRAWING_MODES.includes(enabledDrawingMode);
  const showSmartDetectCard = SMART_DETECT_CAPABLE_MODES.includes(enabledDrawingMode);
  const showOrientation = ORIENTATION_CAPABLE_MODES.includes(enabledDrawingMode);
  const showAutoMerge = enabledDrawingMode === "POLYGON_RECTANGLE";

  // Kept for future use (e.g. to conditionally show helper UI per target).
  // Referenced here so the helper stays imported by the component.
  const effectiveDetection = getEffectiveDetectionMode({
    enabledDrawingMode,
    smartDetectEnabled,
  });
  void effectiveDetection;

  // state

  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // render

  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: "fit-content",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Drag handle header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          bgcolor: "panel.headerBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: "panel.textLight" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: "panel.textMuted" }}
        >
          {titleS}
        </Typography>
      </Box>

      <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        {!isSegmentSelectMode && enabledDrawingMode !== "REASSIGN_TEMPLATE" && <CardLoupe />}
        {enabledDrawingMode === "REASSIGN_TEMPLATE" && (
          <Box
            sx={{
              px: 1.5,
              py: 1.5,
              borderRadius: 1,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              fontSize: "0.875rem",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Cliquez sur une annotation pour modifier son modèle
          </Box>
        )}
        {showSmartDetectCard && (
          <CardSmartDetect showOrientation={showOrientation} />
        )}
        {enabledDrawingMode === "SURFACE_DROP" && <SectionSurfaceDropOptions />}
        {showSegmentLength && <SectionSegmentLength />}
        {showAutoMerge && (
          <Paper
            elevation={0}
            sx={{
              px: 1,
              py: 0.5,
              bgcolor: "background.default",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Fusion automatique
            </Typography>
            <Switch
              size="small"
              checked={Boolean(autoMergeOnCommit)}
              onChange={(e) => dispatch(setAutoMergeOnCommit(e.target.checked))}
            />
          </Paper>
        )}
        <SectionShortcutHelpers />
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// PopperMapListings — main floating panel (or drawing helper when drawing)
// ---------------------------------------------------------------------------

export default function PopperMapListings() {
  // strings

  const addListS = "+ Liste";

  // data

  const dispatch = useDispatch();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const enabledDrawingMode = useSelector(
    (s) => s.mapEditor.enabledDrawingMode
  );
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const showMapListingsPanel = useSelector(
    (s) => s.mapEditor.showMapListingsPanel
  );
  const isBaseMapsViewer = viewerKey === "BASE_MAPS";
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const collapsed = useSelector((s) => s.popperMapListings.collapsed);
  const selectedItem = useSelector((s) => s.selection.selectedItems[0] || null);

  const baseMap = useMainBaseMap();
  const layers = useLayers({ filterByBaseMapId: baseMap?.id });
  const versionsCount = baseMap?.versions?.length ?? 0;

  // Auto-enable showLayers when baseMap has layers in MAP viewer
  useEffect(() => {
    if (viewerKey === "MAP") {
      dispatch(setShowLayers(layers?.length > 0));
    }
  }, [layers?.length, viewerKey]);

  // single annotation source for all counts
  const allAnnotations = useAnnotationsV2({
    caller: "PopperMapListings",
    enabled: viewerKey === "MAP" || viewerKey === "BASE_MAPS",
    filterByMainBaseMap: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    withQties: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
  });

  const annotationTemplates = useAnnotationTemplates();
  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const annotationCountByListingId = useMemo(() => {
    if (!allAnnotations) return {};
    return allAnnotations.reduce((acc, a) => {
      if (a.listingId) acc[a.listingId] = (acc[a.listingId] || 0) + 1;
      return acc;
    }, {});
  }, [allAnnotations]);

  const annotationsByListingId = useMemo(() => {
    if (!allAnnotations) return {};
    return allAnnotations.reduce((acc, a) => {
      if (a.listingId) {
        if (!acc[a.listingId]) acc[a.listingId] = [];
        acc[a.listingId].push(a);
      }
      return acc;
    }, {});
  }, [allAnnotations]);

  const titleS = isBaseMapsViewer
    ? "Dessins sur fond de plan"
    : "Annotations";

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    ...(isBaseMapsViewer
      ? { filterByIsForBaseMaps: true }
      : { excludeIsForBaseMaps: true }),
  });

  const createVersion = useCreateBaseMapVersion();
  const replaceVersionImage = useReplaceVersionImage();

  // state

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const comesFromListing = viewerReturnContext?.fromViewer === "LISTING";
  const [expandedListingIds, setExpandedListingIds] = useState([]);
  const [openCreateListing, setOpenCreateListing] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);

  const [mergeResult, setMergeResult] = useState(null);
  const [openMergeCompare, setOpenMergeCompare] = useState(false);
  const [mergeCreateNewVersion, setMergeCreateNewVersion] = useState(true);
  const { position, isDragging, handleMouseDown } = usePanelDrag();

  // helpers - filter listings when coming from LISTING viewer

  const returnListingId = viewerReturnContext?.listingId;
  const displayedListings = comesFromListing && returnListingId
    ? listings?.filter((l) => l.id === returnListingId)
    : listings;

  // effects - auto-expand selected listing (or first listing by default)

  useEffect(() => {
    if (selectedListingId && listings?.some((l) => l.id === selectedListingId)) {
      setExpandedListingIds((prev) =>
        prev.includes(selectedListingId) ? prev : [...prev, selectedListingId]
      );
    } else if (listings?.length && expandedListingIds.length === 0) {
      setExpandedListingIds([listings[0].id]);
    }
  }, [selectedListingId, listings]);

  // handlers - interaction mode

  function handleInteractionModeChange(_event, next) {
    if (!next || next === interactionMode) return;
    if (next === "SELECT") {
      dispatch(setSoloMode(true));
    } else if (interactionMode === "SELECT") {
      dispatch(setSoloMode(false));
    }
    if (interactionMode === "EDIT" && next !== "EDIT") {
      if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
        dispatch(setSelectedItem(null));
      }
    }
    dispatch(setInteractionMode(next));
  }

  // effect - ESC clears the EDIT target template

  useEffect(() => {
    if (interactionMode !== "EDIT") return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
        dispatch(setSelectedItem(null));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactionMode, selectedItem?.type, dispatch]);

  // handlers

  function handleToggleExpand(listingId) {
    setExpandedListingIds((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId]
    );
  }

  function handleMergeResult(file, listingName) {
    const objectUrl = URL.createObjectURL(file);
    setMergeResult({ file, label: `Fusion ${listingName || "annotations"}`, objectUrl });
    setOpenMergeCompare(true);
    setMergeCreateNewVersion(true);
  }

  function handleCloseMergeCompare() {
    if (mergeResult?.objectUrl) URL.revokeObjectURL(mergeResult.objectUrl);
    setMergeResult(null);
    setOpenMergeCompare(false);
  }

  async function handleSaveMerge() {
    const activeVersion = baseMap?.getActiveVersion?.();
    if (!mergeResult?.file || !baseMap?.id || !activeVersion?.id) return;

    const originalTransform = baseMap.getActiveVersionTransform();
    const originalImageSize = baseMap.getActiveImageSize();
    let transform;
    if (originalImageSize && mergeResult.objectUrl) {
      const newSize = await new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = mergeResult.objectUrl;
      });
      if (newSize && newSize.width > 0) {
        const scale =
          (originalImageSize.width * (originalTransform.scale || 1)) /
          newSize.width;
        transform = { ...originalTransform, scale };
      }
    }

    if (mergeCreateNewVersion) {
      await createVersion(baseMap.id, mergeResult.file, {
        label: mergeResult.label,
        transform,
      });
    } else {
      await replaceVersionImage(baseMap.id, activeVersion.id, mergeResult.file, {
        transform,
      });
    }
    handleCloseMergeCompare();
  }

  // render

  if (Boolean(enabledDrawingMode)) {
    return <PopperDrawingHelper />;
  }

  // PopperMapListings is always visible in BASE_MAPS viewer


  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 50,
        left: 50,
        zIndex: 10,
        width: 290,
        maxHeight: "calc(100% - 50px - 80px)",
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
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
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

        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
        >
          {titleS}
        </Typography>

        {/* Properties button (on hover, left of +Liste) */}
        {headerHovered && !isBaseMapsViewer && (
          <Tooltip title="Propriétés">
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                dispatch(
                  setSelectedItem({
                    id: selectedScopeId,
                    type: "SCOPE",
                  })
                );
                dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
              }}
              sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
            >
              <Tune sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* + Liste button in header */}
        {!comesFromListing && !isBaseMapsViewer && (
          <Box
            component="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setOpenCreateListing(true);
            }}
            sx={{
              fontSize: "10.5px",
              color: "panel.textLight",
              bgcolor: "transparent",
              border: "1px dashed",
              borderColor: "panel.border",
              borderRadius: 1,
              px: 0.75,
              py: 0.25,
              cursor: "pointer",
              fontFamily: "inherit",
              "&:hover": {
                borderColor: "panel.textMuted",
                color: "panel.textMuted",
              },
            }}
          >
            {addListS}
          </Box>
        )}

        {/* Collapse / expand body */}
        <Tooltip title={collapsed ? "Déplier" : "Replier"}>
          <IconButton
            size="small"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch(setCollapsed(!collapsed));
            }}
            sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
          >
            {collapsed ? (
              <UnfoldMore sx={{ fontSize: 16 }} />
            ) : (
              <UnfoldLess sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {!collapsed && (<>
      {/* Interaction mode toggle (DRAW / EDIT / SELECT) */}
      {!isBaseMapsViewer && (
        <Box
          sx={{
            px: 1,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <ToggleButtonGroup
            value={interactionMode}
            exclusive
            size="small"
            fullWidth
            onChange={handleInteractionModeChange}
          >
            <ToggleButton
              value="DRAW"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25 }}
            >
              <DrawIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Dessin
              </Typography>
            </ToggleButton>
            <ToggleButton
              value="SELECT"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25 }}
            >
              <IconPointer sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Sélection
              </Typography>
            </ToggleButton>
            <ToggleButton
              value="EDIT"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25 }}
            >
              <SwapHorizIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Modification
              </Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Warning: base map has no scale */}
      {baseMap && !baseMap.meterByPx && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mx: 1,
            mt: 1,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.error.main, 0.3),
          }}
        >
          <WarningAmber sx={{ fontSize: 18, color: "error.main", flexShrink: 0 }} />
          <Typography
            variant="caption"
            sx={{ color: "error.main", fontWeight: 500, lineHeight: 1.3 }}
          >
            Ce plan n'est pas à l'échelle. Les mesures ne seront pas fiables.
          </Typography>
        </Box>
      )}

      {!displayedListings?.length && !isBaseMapsViewer ? (
        /* Empty state helper */
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 4,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "panel.textMuted",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Pour dessiner, créez d'abord une liste de modèles d'annotations
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setOpenCreateListing(true)}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Nouvelle liste
          </Button>
        </Box>
      ) : (
        <>
          {/* Scrollable listings */}
          <Box sx={{ overflow: "auto", flex: 1 }}>
            {viewerKey === "MAP" && showLayers && (
              <SectionLayers baseMapId={baseMap?.id} />
            )}

            {isBaseMapsViewer
              ? displayedListings?.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    isExpanded={expandedListingIds.includes(listing.id)}
                    onToggleExpand={handleToggleExpand}
                    hiddenListingsIds={hiddenListingsIds}
                    annotationCount={
                      annotationsByListingId?.[listing.id]?.length || 0
                    }
                    annotations={annotationsByListingId?.[listing.id]}
                    annotationTemplateById={annotationTemplateById}
                    extraAction={
                      <ButtonMergeListingAnnotations
                        listingId={listing.id}
                        baseMap={baseMap}
                        onResult={(file) =>
                          handleMergeResult(file, listing.name)
                        }
                      />
                    }
                  />
                ))
              : <>
                  {displayedListings?.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      isExpanded={expandedListingIds.includes(listing.id)}
                      onToggleExpand={handleToggleExpand}
                      hiddenListingsIds={hiddenListingsIds}
                      annotationCount={
                        annotationCountByListingId?.[listing.id] || 0
                      }
                      annotations={annotationsByListingId?.[listing.id]}
                      annotationTemplateById={annotationTemplateById}
                    />
                  ))}
                </>}

            {/* Outils section — only in DRAW mode */}
            {interactionMode === "DRAW" && (
              <>
                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    bgcolor: "panel.sectionBg",
                    borderTop: "1px solid",
                    borderColor: "panel.border",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "panel.textMuted",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontSize: "11px",
                    }}
                  >
                    Outils de découpe
                  </Typography>
                </Box>
                <List dense disablePadding>
                  {TOOL_ITEMS.map((tool) => (
                    <ToolRow
                      key={tool.type}
                      type={tool.type}
                      label={tool.label}
                      Icon={tool.Icon}
                    />
                  ))}
                </List>
              </>
            )}

          </Box>
        </>
      )}
      </>)}

      {/* Create listing dialog */}
      {openCreateListing && (
        <DialogCreateListing
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
          isForBaseMaps={isBaseMapsViewer}
        />
      )}


      {/* Merge compare dialog */}
      {openMergeCompare && mergeResult && (
        <DialogGeneric
          open={openMergeCompare}
          vh={90}
          onClose={handleCloseMergeCompare}
        >
          <BoxFlexVStretch sx={{ width: 1, height: 1, position: "relative" }}>
            <SectionCompareTwoImages
              imageUrl1={mergeResult.objectUrl}
              imageUrl2={baseMap?.getUrl?.()}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "white",
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                boxShadow: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={mergeCreateNewVersion}
                    onChange={(e) => setMergeCreateNewVersion(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption" color="text.primary">
                    Nouvelle version
                  </Typography>
                }
              />
              <ButtonGeneric
                label="Enregistrer"
                variant="contained"
                color="secondary"
                onClick={handleSaveMerge}
              />
            </Box>
          </BoxFlexVStretch>
        </DialogGeneric>
      )}
    </Paper>
  );
}
