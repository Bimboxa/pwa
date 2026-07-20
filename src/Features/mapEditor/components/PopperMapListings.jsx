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

import { setSelectedListingId } from "Features/listings/listingsSlice";
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
  Popper,
  Chip,
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
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { StopCircle, Create, AddLocationAlt, AutoFixHigh, RotateRight } from "@mui/icons-material";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import IconCutLine from "Features/icons/IconCutLine";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconCutSurface from "Features/icons/IconCutSurface";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ProcedurePopperContent from "Features/annotationsAuto/components/ProcedurePopperContent";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import CardLoupe from "Features/smartDetect/components/CardLoupe";
import CardSmartDetect from "Features/smartDetect/components/CardSmartDetect";
import SectionSurfaceDropOptions from "Features/smartDetect/components/SectionSurfaceDropOptions";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import PopperSubtractHelper from "Features/mapEditor/components/PopperSubtractHelper";
import getEffectiveDetectionMode from "Features/mapEditor/utils/getEffectiveDetectionMode";
import { isPasteAdjustEligible } from "Features/smartDetect/utils/adjustPasteCandidate";
import SectionLayers from "Features/layers/components/SectionLayers";
import {
  setShowLayers,
  setSoloVisibleTemplateIds,
  setSoloListingId,
  setSoloMode,
  setCollapsed,
} from "Features/popperMapListings/popperMapListingsSlice";
import DrawIcon from "@mui/icons-material/Draw";
import EditIcon from "@mui/icons-material/Edit";
import IconPointer from "Features/icons/IconPointer";
import useLayers from "Features/layers/hooks/useLayers";
import { alpha } from "@mui/material/styles";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
  setAutoMergeOnCommit,
  setAutoOffsetsOnCommit,
  setAvoidVisibleAnnotationsOnCommit,
  setPasteDetectionMode,
  setRepairMode,
} from "Features/mapEditor/mapEditorSlice";

import { REPAIR_MODES } from "Features/localizedRepair/constants/repairShortcuts";
import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import { keyframes } from "@emotion/react";
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
import { getHotkeyForToolInGroup } from "Features/mapEditor/constants/drawingToolHotkeys";
import { getFreeAnnotationShortcut } from "Features/mapEditor/constants/freeAnnotationShortcuts";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import buildToolDraft from "Features/mapEditor/utils/buildToolDraft";
import applyInteractionModeChange from "Features/mapEditor/utils/applyInteractionModeChange";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import useListings from "Features/listings/hooks/useListings";
import useFreeAnnotationTemplates from "Features/mapEditor/hooks/useFreeAnnotationTemplates";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// ---------------------------------------------------------------------------
// TOOL_ITEMS — static tool definitions for the "Outils" section
// ---------------------------------------------------------------------------

// Small shortcut letter chip pinned to the bottom-right of each interaction
// mode ToggleButton (D / M / S). Mirrors the tool badges of the bottom drawing
// toolbar (ToolbarDrawingDraft); offsets are kept inside the button so the
// ToggleButton overflow doesn't clip it.
function ModeShortcutBadge({ children }) {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 2,
        right: 2,
        minWidth: 12,
        height: 12,
        px: "2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "3px",
        bgcolor: "background.paper",
        fontSize: 8,
        fontWeight: 700,
        lineHeight: 1,
        color: "text.secondary",
      }}
    >
      {children}
    </Box>
  );
}

// TODO: clean up the code behind the drawing tools removed from this UI list
// (SPLIT_SURFACE "Couper des surfaces", TECHNICAL_RETURN "Retour 1m",
// ADD_INNER_POINT "Ajouter un point", LOCALIZED_REPAIR "Réparation localisée").
// Once confirmed unused elsewhere, drop their interaction handlers / drawing
// modes / hooks and the now-unused icon imports (IconCutSurface,
// IconTechnicalReturn, AddLocationAlt, AutoFixHigh) and the REPAIR_MODES /
// SectionRepairModes wiring.
const TOOL_ITEMS = [
  { type: "CUT", label: "Ouverture", Icon: StopCircle, shortcut: "O" },
  { type: "SPLIT_LINE", label: "Retirer un segment", Icon: IconCutLine, shortcut: "X" },
  { type: "SPLIT_POLYLINE_CLICK", label: "Couper un segment", Icon: IconSplitPolylineClick, shortcut: "C" },
  { type: "COMPLETE_ANNOTATION", label: "Prolonger", Icon: Create },
  { type: "REVOLUTION", label: "Axe de révolution", Icon: RotateRight },
];

// ---------------------------------------------------------------------------
// ToolRow — one cut/split tool with click-to-draw + tool picker menu
// ---------------------------------------------------------------------------

function ToolRow({ type, label, Icon, shortcut }) {
  const dispatch = useDispatch();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[type]
  );
  const openingStrokeWidth = useSelector((s) => s.mapEditor.openingStrokeWidth);
  const openingStrokeWidthUnit = useSelector(
    (s) => s.mapEditor.openingStrokeWidthUnit
  );
  const openingDefaults = {
    strokeWidth: openingStrokeWidth,
    strokeWidthUnit: openingStrokeWidthUnit,
  };

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
    dispatch(setEnabledDrawingMode(activeTool.drawingMode ?? activeTool.key));
    dispatch(
      setNewAnnotation(buildToolDraft(newAnnotation, activeTool, openingDefaults))
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
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
    dispatch(setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults)));
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
          {shortcut && (
            <Box sx={{ mr: 1, flexShrink: 0 }}>
              <ShortcutBadge>{shortcut}</ShortcutBadge>
            </Box>
          )}
          <Typography variant="body2" sx={{ color: "panel.textSecondary", userSelect: "none" }}>
            {label}
          </Typography>
        </Box>

        {/* Right side: active tool icon on hover (only when there is a choice) */}
        {isHovered && ActiveToolIcon && tools.length > 1 && (
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
      {tools.map((tool) => {
        const hotkey = getHotkeyForToolInGroup(tool, tools);
        return (
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
            {hotkey && (
              <Box
                sx={{
                  ml: "auto",
                  minWidth: 16,
                  height: 16,
                  px: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 0.5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "text.secondary",
                  lineHeight: 1,
                }}
              >
                {hotkey}
              </Box>
            )}
          </MenuItem>
        );
      })}

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

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];
  const linkedProcedures = (annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasProcedure = linkedProcedures.length > 0;
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState("");
  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);
  const [nameAnchorEl, setNameAnchorEl] = useState(null);
  const procedurePopperCloseTimer = useRef(null);

  // Keep the procedure popper open while hovering the chip OR the popper itself
  // (so its action buttons stay clickable), with a small close delay to bridge
  // the gap between them.
  const openProcedurePopper = (e) => {
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    setNameAnchorEl(e.currentTarget);
  };
  const cancelCloseProcedurePopper = () => {
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
  };
  const scheduleCloseProcedurePopper = () => {
    if (procedurePopperCloseTimer.current)
      clearTimeout(procedurePopperCloseTimer.current);
    procedurePopperCloseTimer.current = setTimeout(
      () => setNameAnchorEl(null),
      150
    );
  };
  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[annotationTemplate?.id]
  );
  const soloMode = useSelector((s) => s.popperMapListings.soloMode);
  const soloVisibleTemplateIds = useSelector(
    (s) => s.popperMapListings.soloVisibleTemplateIds
  );
  const soloListingId = useSelector((s) => s.popperMapListings.soloListingId);
  // "Maillage" toggle and the shared ?mode=viewer lock force SELECT-like
  // interaction → use the effective mode for all behavior gating in this row.
  const rawInteractionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const isThreedViewer = useSelector((s) =>
    isThreedFamilyViewerKey(s.viewers.selectedViewerKey)
  );
  // Dessin module toggled to its 3D editor (raw module key stays "MAP"):
  // only OBJECT_3D (3D placement mode), POLYGON / POLYLINE templates
  // (template-driven 3D face drawing) and COTE templates (template-driven
  // 2-click cote) can start a draw there — other shapes would set a
  // dead-end 2D drawing state.
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const interactionMode =
    showMeshCells || isThreedViewer || viewerMode
      ? "SELECT"
      : rawInteractionMode;
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
    !soloVisibleTemplateIds.includes(annotationTemplate?.id);
  const isHidden = isHiddenBySolo || isHiddenByBase;
  // Free annotations show their keyboard shortcut (L / P) next to the icon.
  const freeShortcut = getFreeAnnotationShortcut(annotationTemplate);
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
    if (
      isThreedToggledEditor &&
      !["OBJECT_3D", "POLYGON", "POLYLINE", "COTE"].includes(drawingShape)
    )
      return;
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
    // 3D viewer: read-only panel — clicking a row toggles solo mode for this
    // template (isolate it; the others render translucent). Visibility stays
    // available via the eye button.
    if (isThreedViewer) {
      onSoloToggle?.(annotationTemplate?.id, listingId);
      return;
    }
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
    if (
      isThreedToggledEditor &&
      !["OBJECT_3D", "POLYGON", "POLYLINE", "COTE"].includes(drawingShape)
    )
      return;
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

  const toggleHidden = async () => {
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden,
    });
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation();
    await toggleHidden();
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
          {freeShortcut && interactionMode === "DRAW" && (
            <Box sx={{ mr: 1, flexShrink: 0 }}>
              <ShortcutBadge>{freeShortcut}</ShortcutBadge>
            </Box>
          )}
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

          {hasProcedure && (
            <Chip
              label="Auto"
              size="small"
              onMouseEnter={openProcedurePopper}
              onMouseLeave={scheduleCloseProcedurePopper}
              sx={{
                ml: 0.5,
                flexShrink: 0,
                height: 16,
                "& .MuiChip-label": {
                  px: 0.5,
                  fontSize: "9px",
                  fontWeight: "bold",
                },
              }}
            />
          )}
        </Box>

        {hasProcedure && (
          <Popper
            open={Boolean(nameAnchorEl)}
            anchorEl={nameAnchorEl}
            placement="bottom-start"
            style={{ zIndex: 2000 }}
            modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
          >
            <Box
              onMouseEnter={cancelCloseProcedurePopper}
              onMouseLeave={scheduleCloseProcedurePopper}
            >
              <ProcedurePopperContent
                procedures={linkedProcedures}
                sourceTemplate={annotationTemplate}
                baseMapId={selectedBaseMapId}
              />
            </Box>
          </Popper>
        )}

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
                {/* Solo button — SELECT mode (incl. 3D read-only viewer) */}
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

function AnnotationTemplatesForListing({
  listingId,
  annotations,
  annotationTemplateById,
  visibleTemplateIds,
}) {
  const dispatch = useDispatch();

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
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const isThreedViewer = useSelector((s) =>
    isThreedFamilyViewerKey(s.viewers.selectedViewerKey)
  );
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

      {/* + Nouveau modele — hidden in 3D (read-only) and while SELECT-filtering */}
      {!isThreedViewer && !visibleTemplateIds && (
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
  annotationCount,
  annotations,
  annotationTemplateById,
  visibleTemplateIds,
  extraAction,
}) {
  const dispatch = useDispatch();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // data

  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

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

  // Toggle every template eye of the listing in one batch write (single
  // Dexie transaction + single refresh), only touching templates whose
  // `hidden` actually changes.
  async function handleToggleVisibility(e) {
    e.stopPropagation();
    const targetHidden = !isHidden;
    const updates = listingTemplates
      .filter((t) => Boolean(t.hidden) !== targetHidden)
      .map((t) => ({ id: t.id, hidden: targetHidden }));
    await updateAnnotationTemplates(updates);
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
          visibleTemplateIds={visibleTemplateIds}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

// Modes that select existing geometry — no smart detect needed
const SEGMENT_SELECT_MODES = [
  "TECHNICAL_RETURN",
  "CUT_SEGMENT",
  "SPLIT_POLYLINE",
  "SPLIT_POLYLINE_CLICK",
];

// Shortcuts of the 3D OBJECT_3D placement mode (Dessin module toggled to 3D)
// — handled by object3DPlacementController.
const THREED_PLACEMENT_SHORTCUTS = [
  { key: "← →", label: "Tourner l'objet de 10°" },
  { key: "⇧ ← →", label: "Tourner l'objet de 1°" },
  { key: "R", label: "Réinitialiser la rotation" },
  { key: "Esc", label: "Quitter le mode dessin" },
];

// Modes where the "Détection auto" card makes sense — the base drawing
// tool has a backing detection algorithm (see getEffectiveDetectionMode).
const SMART_DETECT_CAPABLE_MODES = [
  "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE", "RECTANGLE",
  "STRIP", "POLYLINE_CLICK", "POLYGON_CLICK",
  // SEGMENT tool → dark-band snapping (SEGMENT_SNAP, hover-only)
  "SEGMENT", "POLYLINE_SEGMENT", "STRIP_SEGMENT",
];

// ---------------------------------------------------------------------------
// SectionRepairModes — localized-repair type selector (Auto / L / T / Lissage),
// one selectable line per mode with its keyboard shortcut at the end.
// ---------------------------------------------------------------------------

function SectionRepairModes() {
  const dispatch = useDispatch();
  const repairMode = useSelector((s) => s.mapEditor.repairMode);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Type de réparation
      </Typography>
      {REPAIR_MODES.map(({ mode, label, shortcut }) => {
        const selected = repairMode === mode;
        return (
          <Paper
            key={mode}
            elevation={0}
            onClick={() => dispatch(setRepairMode(mode))}
            sx={{
              px: 1,
              py: 0.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              border: "1px solid",
              borderColor: selected ? "primary.main" : "transparent",
              bgcolor: selected ? "primary.main" : "background.default",
              color: selected ? "primary.contrastText" : "text.secondary",
              "&:hover": { bgcolor: selected ? "primary.main" : "action.hover" },
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: selected ? 600 : 400 }}>
              {label}
            </Typography>
            <Box
              sx={{
                px: 0.5,
                py: 0,
                borderRadius: 0.5,
                bgcolor: selected ? "rgba(255,255,255,0.25)" : "action.hover",
                color: selected ? "primary.contrastText" : "text.secondary",
                fontSize: "0.65rem",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {shortcut}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}

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
  // Dessin module toggled to its 3D editor: the drawing state drives the 3D
  // OBJECT_3D placement mode. The 2D-only helpers (loupe, 2D shortcuts) must
  // not mount — CardLoupe's SmartZoomContext only exists in the 2D editor.
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const autoMergeOnCommit = useSelector(
    (s) => s.mapEditor.autoMergeOnCommit
  );
  const autoOffsetsOnCommit = useSelector(
    (s) => s.mapEditor.autoOffsetsOnCommit
  );
  const avoidVisibleAnnotationsOnCommit = useSelector(
    (s) => s.mapEditor.avoidVisibleAnnotationsOnCommit
  );
  const isSegmentSelectMode = SEGMENT_SELECT_MODES.includes(enabledDrawingMode);
  const showSmartDetectCard = SMART_DETECT_CAPABLE_MODES.includes(enabledDrawingMode);
  const showAutoMerge =
    enabledDrawingMode === "POLYGON_RECTANGLE" ||
    enabledDrawingMode === "POLYGON_CLICK";
  const showAutoOffsets = enabledDrawingMode === "POLYGON_CLICK";
  const showAvoidVisibleAnnotations =
    enabledDrawingMode === "POLYGON_RECTANGLE" ||
    enabledDrawingMode === "POLYGON_CLICK" ||
    enabledDrawingMode === "SURFACE_DROP";

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
        {!isThreedToggledEditor &&
          !isSegmentSelectMode &&
          enabledDrawingMode !== "REASSIGN_TEMPLATE" &&
          enabledDrawingMode !== "LOCALIZED_REPAIR" && <CardLoupe />}
        {isThreedToggledEditor && (
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
            {"Cliquez sur le plan pour poser l'objet 3D"}
          </Box>
        )}
        {enabledDrawingMode === "LOCALIZED_REPAIR" && <SectionRepairModes />}
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
        {enabledDrawingMode === "CUT_SEGMENT" && (
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
            Cliquez sur un segment pour le supprimer
          </Box>
        )}
        {enabledDrawingMode === "SPLIT_POLYLINE_CLICK" && (
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
            {"Cliquez sur un point le long d'une polyligne pour la couper en 2"}
          </Box>
        )}
        {showSmartDetectCard && (
          <CardSmartDetect />
        )}
        {enabledDrawingMode === "SURFACE_DROP" && <SectionSurfaceDropOptions />}
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
        {showAvoidVisibleAnnotations && (
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
              Eviter les annotations visibles
            </Typography>
            <Switch
              size="small"
              checked={Boolean(avoidVisibleAnnotationsOnCommit)}
              onChange={(e) =>
                dispatch(setAvoidVisibleAnnotationsOnCommit(e.target.checked))
              }
            />
          </Paper>
        )}
        {showAutoOffsets && (
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                Offsets automatiques
              </Typography>
              <Box
                sx={{
                  px: 0.5,
                  py: 0,
                  borderRadius: 0.5,
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                O
              </Box>
            </Box>
            <Switch
              size="small"
              checked={Boolean(autoOffsetsOnCommit)}
              onChange={(e) =>
                dispatch(setAutoOffsetsOnCommit(e.target.checked))
              }
            />
          </Paper>
        )}
        <SectionShortcutHelpers
          shortcuts={
            isThreedToggledEditor ? THREED_PLACEMENT_SHORTCUTS : undefined
          }
        />
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// PopperPasteHelper — floating panel shown while a copy/paste is active
// ---------------------------------------------------------------------------

// Flashing neon-green pulse on the "Espace" badge when a detection is
// available — mirrors CardSmartDetect.
const detectionPulse = keyframes`
  0%   { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
  50%  { background-color: #00ff0066; box-shadow: 0 0 10px #00ff00; }
  100% { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
`;

function PasteShortcutRow({ label, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Typography
        variant="body2"
        sx={{ color: "text.primary", fontSize: "0.85rem" }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function PopperPasteHelper() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Mode copier/coller";

  // data

  const pasteDetectionMode = useSelector(
    (s) => s.mapEditor.pasteDetectionMode
  );
  const smartDetectionPresent = useSelector(
    (s) => s.mapEditor.smartDetectionPresent
  );
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);

  const copiedCount = pasteClipboard?.items?.length ?? 0;
  // Pattern detection is single-template only.
  const isSingle = copiedCount === 1;
  // "Ajuster" (J) only applies to POLYGON / 2-pt POLYLINE / 2-pt STRIP.
  const isAdjustEligible = isPasteAdjustEligible(pasteClipboard);

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
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="caption"
          sx={{ color: "panel.textLight", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          {copiedCount > 1
            ? `${copiedCount} annotations`
            : "1 annotation"}
        </Typography>
      </Box>

      <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        {/* Detection card — single-template only; hidden in multi-selection. */}
        {isSingle && (
        <Paper
          variant="outlined"
          sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              Détection automatique
            </Typography>
            <Switch
              size="small"
              checked={pasteDetectionMode === "GLOBAL"}
              onChange={(_e, checked) =>
                dispatch(setPasteDetectionMode(checked ? "GLOBAL" : null))
              }
            />
            <ShortcutBadge>A</ShortcutBadge>
          </Box>

          <Box
            sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              Détection au survol
            </Typography>
            <Switch
              size="small"
              checked={pasteDetectionMode === "HOVER"}
              onChange={(_e, checked) =>
                dispatch(setPasteDetectionMode(checked ? "HOVER" : null))
              }
            />
            <ShortcutBadge>S</ShortcutBadge>
          </Box>

          {isAdjustEligible && (
            <Box
              sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Ajuster
              </Typography>
              <Switch
                size="small"
                checked={pasteDetectionMode === "ADJUST"}
                onChange={(_e, checked) =>
                  dispatch(setPasteDetectionMode(checked ? "ADJUST" : null))
                }
              />
              <ShortcutBadge>J</ShortcutBadge>
            </Box>
          )}

          {pasteDetectionMode && (
            <Box
              sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                Valider la détection
              </Typography>
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 56,
                  height: 22,
                  px: 0.5,
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: smartDetectionPresent
                    ? "#00aa00"
                    : "text.disabled",
                  backgroundColor: smartDetectionPresent
                    ? undefined
                    : (theme) => theme.palette.action.hover,
                  borderBottomWidth: "3px",
                  color: smartDetectionPresent ? "#000" : "text.primary",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: "0.7rem",
                  lineHeight: 1,
                  animation: smartDetectionPresent
                    ? `${detectionPulse} 0.8s ease-in-out infinite`
                    : "none",
                }}
              >
                Espace
              </Box>
            </Box>
          )}
        </Paper>
        )}

        {/* Keyboard shortcuts card — same style as SectionShortcutHelpers */}
        <Box
          sx={{
            backgroundColor: (theme) =>
              alpha(theme.palette.background.paper, 0.8),
            backdropFilter: "blur(8px)",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            p: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              mb: 2,
              fontWeight: 600,
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontSize: "0.75rem",
            }}
          >
            Raccourcis Clavier
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <PasteShortcutRow label="Coller la copie">
              <ShortcutBadge>Clic</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Pivoter 90°">
              <ShortcutBadge>R</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Miroir">
              <ShortcutBadge>I</ShortcutBadge>
            </PasteShortcutRow>
            <PasteShortcutRow label="Quitter le mode copier/coller">
              <ShortcutBadge>Esc</ShortcutBadge>
            </PasteShortcutRow>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// FreeAnnotationRows — standalone "Ligne" / "Surface" rows (no entity, backed
// by hidden per-scope system templates). Rendered as a small untitled section.
// ---------------------------------------------------------------------------

function FreeAnnotationRows({ annotationsByListingId, annotationTemplateById }) {
  const { listingId, lineTemplate, surfaceTemplate } =
    useFreeAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  const templates = [lineTemplate, surfaceTemplate].filter(Boolean);

  // quantities — same computation as a normal listing's rows
  const annotations = annotationsByListingId?.[listingId];
  const qtiesById = useMemo(
    () => computeAnnotationTemplateQties(annotations, annotationTemplateById),
    [annotations, annotationTemplateById]
  );

  if (!templates.length) return null;

  return (
    <List dense disablePadding>
      {templates.map((template) => {
        const templateQties = qtiesById?.[template.id];
        const count = templateQties?.count || 0;
        const qtyLabel = templateQties?.mainQtyLabel;
        return (
          <AnnotationTemplateRow
            key={template.id}
            annotationTemplate={template}
            count={count}
            qtyLabel={qtyLabel}
            listingId={listingId}
            spriteImage={spriteImage}
          />
        );
      })}
    </List>
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
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const subtractSourceAnnotationId = useSelector(
    (s) => s.mapEditor.subtractSourceAnnotationId
  );
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
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  // "Maillage" toggle: shows mesh cells instead of meshed parents and forces a
  // SELECT-like (read-only) interaction. The mode toggle is disabled while on.
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  // viewer mode (?mode=viewer) locks the editor to read-only SELECT.
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const effectiveInteractionMode =
    showMeshCells || isThreedViewer || viewerMode ? "SELECT" : interactionMode;
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

  // Solo filtering is available in the 3D viewer (read-only) and in 2D SELECT mode.
  // Entering 3D enables it; leaving 3D restores the 2D mode's solo state and prevents
  // the solo filter from leaking into the 2D MAP viewer (where the button is hidden in DRAW).
  useEffect(() => {
    dispatch(setSoloMode(isThreedViewer || interactionMode === "SELECT"));
  }, [isThreedViewer]);

  // 3D can show annotations from several base maps at once; mirror those extra
  // base maps here so the panel's visible set matches the 3D scene.
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();

  // single annotation source for all counts and for the SELECT-mode visibility
  // filter. `ignoreSolo` keeps this set stable while the user solos a template
  // (solo must not remove rows from the tree), `keepHiddenTemplates` keeps
  // eye-hidden templates' annotations so their rows stay in the tree (greyed)
  // and can be re-enabled. In 3D, the 3D-specific filters are mirrored so the
  // set matches what the scene actually shows.
  const allAnnotationsInclHidden = useAnnotationsV2({
    caller: "PopperMapListings",
    enabled:
      viewerKey === "MAP" ||
      viewerKey === "BASE_MAPS" ||
      viewerKey === "ZONES" ||
      isThreedViewer,
    filterByMainBaseMap: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    withQties: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
    ignoreSolo: true,
    keepHiddenTemplates: true,
    ...(isThreedViewer
      ? {
          extraBaseMapIds,
          filterBySelectedScope: true,
          excludeProfileTemplates: true,
          excludeListingsIds: hiddenListingsIds,
        }
      : {}),
  });

  // visible-only set for counts and qties (matches what's on screen).
  const allAnnotations = useMemo(
    () => allAnnotationsInclHidden?.filter((a) => !a.hidden),
    [allAnnotationsInclHidden]
  );

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

  const { value: locatedListings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    ...(isBaseMapsViewer
      ? { filterByIsForBaseMaps: true }
      : { excludeIsForBaseMaps: true }),
  });

  // ZONES module: the zoning listings (one template per zone) are listed ahead
  // of the normal listings so zone polygons can be drawn from the popper.
  const { value: zoningListings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "ZONING",
  });

  const listings = useMemo(() => {
    if (!isZonesViewer) return locatedListings;
    return [...(zoningListings ?? []), ...(locatedListings ?? [])];
  }, [isZonesViewer, zoningListings, locatedListings]);

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
  // The "Annotations libres" system listing is rendered as standalone rows
  // (FreeAnnotationRows), never in the normal listing tree.
  const visibleListings = listings?.filter(
    (l) => !l.isFreeAnnotationsListing
  );

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
    if (isThreedViewer && hideMainAnnotationsIn3d)
      arr = arr.filter((a) => a.baseMapId !== baseMap?.id);
    return arr;
  }, [allAnnotationsInclHidden, isThreedViewer, hideMainAnnotationsIn3d, baseMap?.id]);
  const isSelectFilter = effectiveInteractionMode === "SELECT";
  const visibleTemplateIds = useMemo(
    () =>
      isSelectFilter
        ? new Set(
            legendAnnotations
              .filter((a) => a.annotationTemplateId)
              .map((a) => a.annotationTemplateId)
          )
        : null,
    [isSelectFilter, legendAnnotations]
  );
  const visibleListingIds = useMemo(
    () =>
      isSelectFilter
        ? new Set(legendAnnotations.map((a) => a.listingId).filter(Boolean))
        : null,
    [isSelectFilter, legendAnnotations]
  );

  const scopedListings = visibleListingIds
    ? visibleListings?.filter((l) => visibleListingIds.has(l.id))
    : visibleListings;
  const displayedListings =
    comesFromListing && returnListingId
      ? scopedListings?.filter((l) => l.id === returnListingId)
      : scopedListings;
  // No listing yet → the header "+ Liste" button becomes the main CTA (contained, orange).
  const hasNoListing = !displayedListings?.length;

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
    applyInteractionModeChange(dispatch, {
      current: interactionMode,
      next,
      selectedItem,
    });
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

  if (!isThreedViewer && pasteClipboard) {
    return <PopperPasteHelper />;
  }

  if (!isThreedViewer && subtractSourceAnnotationId) {
    return <PopperSubtractHelper />;
  }

  if (!isThreedViewer && Boolean(enabledDrawingMode)) {
    return <PopperDrawingHelper />;
  }

  // in BASE_MAPS viewer, mounting is gated by popperMapListings.showInBaseMapsViewer (see MainMapEditorV3)

  return (
    <Paper
      elevation={4}
      data-capture-hide
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
                    type: "POPPER_MAP_LISTINGS",
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
        {!comesFromListing && !isBaseMapsViewer && !isThreedViewer && (
          <Box
            component="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setOpenCreateListing(true);
            }}
            sx={{
              fontSize: "10.5px",
              borderRadius: 1,
              px: 0.75,
              py: 0.25,
              cursor: "pointer",
              fontFamily: "inherit",
              ...(hasNoListing
                ? {
                    // contained CTA when no listing exists yet
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
      {/* Interaction mode toggle (DRAW / EDIT / SELECT) — hidden in 3D and viewer mode (read-only) */}
      {!isThreedViewer && !viewerMode && (
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
            disabled={showMeshCells}
            onChange={handleInteractionModeChange}
          >
            <ToggleButton
              value="DRAW"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25, position: "relative" }}
            >
              <DrawIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Dessin
              </Typography>
              <ModeShortcutBadge>D</ModeShortcutBadge>
            </ToggleButton>
            <ToggleButton
              value="EDIT"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25, position: "relative" }}
            >
              <EditIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Modification
              </Typography>
              <ModeShortcutBadge>M</ModeShortcutBadge>
            </ToggleButton>
            <ToggleButton
              value="SELECT"
              sx={{ flex: 1, py: 0.5, flexDirection: "column", gap: 0.25, position: "relative" }}
            >
              <IconPointer sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: "10px", lineHeight: 1, textTransform: "none" }}>
                Sélection
              </Typography>
              <ModeShortcutBadge>S</ModeShortcutBadge>
            </ToggleButton>
          </ToggleButtonGroup>

        </Box>
      )}

      {/* Standard body (layers / listings / cut tools) */}
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

      {/* Scrollable listings */}
      <Box sx={{ overflow: "auto", flex: 1 }}>
        {viewerKey === "MAP" && showLayers && (
          <SectionLayers baseMapId={baseMap?.id} />
        )}

        {/* Free annotations — untitled section at the very top: just
            "Ligne" + "Surface" (no entity, hidden per-scope templates).
            Always shown, even when no listing exists, since these are
            system templates. */}
        {!isBaseMapsViewer && (
          <Box
            sx={{
              borderBottom: "1px solid",
              borderColor: "panel.border",
            }}
          >
            <Divider sx={{ borderColor: "panel.border" }} />
            <FreeAnnotationRows
              annotationsByListingId={annotationsByListingId}
              annotationTemplateById={annotationTemplateById}
            />
          </Box>
        )}

        <>
            {isBaseMapsViewer
              ? displayedListings?.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    isExpanded={expandedListingIds.includes(listing.id)}
                    onToggleExpand={handleToggleExpand}
                    annotationCount={
                      annotationsByListingId?.[listing.id]?.length || 0
                    }
                    annotations={annotationsByListingId?.[listing.id]}
                    annotationTemplateById={annotationTemplateById}
                    visibleTemplateIds={visibleTemplateIds}
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
                      annotationCount={
                        annotationCountByListingId?.[listing.id] || 0
                      }
                      annotations={annotationsByListingId?.[listing.id]}
                      annotationTemplateById={annotationTemplateById}
                      visibleTemplateIds={visibleTemplateIds}
                    />
                  ))}
                </>}

            {/* Outils section — only in DRAW mode */}
            {effectiveInteractionMode === "DRAW" && (
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
                    Outils de dessin
                  </Typography>
                </Box>
                <List dense disablePadding>
                  {TOOL_ITEMS.map((tool) => (
                    <ToolRow
                      key={tool.type}
                      type={tool.type}
                      label={tool.label}
                      Icon={tool.Icon}
                      shortcut={tool.shortcut}
                    />
                  ))}
                </List>
              </>
            )}

        </>
      </Box>
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
