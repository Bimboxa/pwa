import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

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
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Add from "@mui/icons-material/Add";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Tune from "@mui/icons-material/Tune";
import { Check, Close } from "@mui/icons-material";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { StopCircle } from "@mui/icons-material";
import ContentCut from "@mui/icons-material/ContentCut";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";
import SectionSmartDetect from "Features/smartDetect/components/SectionSmartDetect";
import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";
import SectionDefaultHeight from "Features/mapEditor/components/SectionDefaultHeight";
import SectionLayers from "Features/layers/components/SectionLayers";
import { alpha } from "@mui/material/styles";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "Features/mapEditor/mapEditorSlice";
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
import useAnnotationTemplateCountById from "Features/annotations/hooks/useAnnotationTemplateCountById";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";

// ---------------------------------------------------------------------------
// TOOL_ITEMS — static tool definitions for the "Outils" section
// ---------------------------------------------------------------------------

const TOOL_ITEMS = [
  { type: "CUT", label: "Ouverture", Icon: StopCircle },
  { type: "SPLIT", label: "Diviser", Icon: ContentCut },
  { type: "TECHNICAL_RETURN", label: "Retour 1m", Icon: IconTechnicalReturn },
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
    dispatch(setNewAnnotation({ ...newAnnotation, type }));
  };

  const handleToolBtnClick = (e) => {
    e.stopPropagation();
    setToolMenuAnchor(e.currentTarget);
  };

  const handleSelectTool = (tool) => {
    dispatch(setSelectedToolKeyForTemplate({ templateId: type, toolKey: tool.key }));
    dispatch(setEnabledDrawingMode(tool.key));
    dispatch(setNewAnnotation({ ...newAnnotation, type }));
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
// AnnotationTemplateRow — one template inside an expanded listing
// ---------------------------------------------------------------------------

function AnnotationTemplateRow({
  annotationTemplate,
  count,
  qtyLabel,
  listingId,
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

  // helpers

  const isHidden = annotationTemplate?.hidden;
  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape);
  const activeTool = selectedToolKey
    ? getDrawingToolByKey(selectedToolKey) ?? tools[0]
    : tools[0];
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

  const handleRowClick = () => {
    if (isEditing) return;
    handleStartDraw();
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
          borderLeft: "3px solid",
          borderColor: isHovered
            ? annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "transparent"
            : "transparent",
          "&:hover": {
            bgcolor: alpha(annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "#999", 0.1),
          },
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
              flexShrink: 0,
              cursor: "pointer",
              "& .icon-default": { display: "flex" },
              "& .icon-settings": { display: "none" },
              "&:hover .icon-default": { display: "none" },
              "&:hover .icon-settings": { display: "flex" },
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditTemplate();
            }}
          >
            <Box
              className="icon-default"
              sx={{
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                opacity: isHidden ? 0.4 : 1,
                filter: isHidden ? "grayscale(100%)" : "none",
              }}
            >
              <AnnotationTemplateIcon template={annotationTemplate} size={18} />
            </Box>
            <Box
              className="icon-settings"
              sx={{
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
              }}
            >
              <Tune sx={{ fontSize: 18, color: annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "panel.textMuted" }} />
            </Box>
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
            <>
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
              {/* Visibility button */}
              <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow>
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

function AnnotationTemplatesForListing({ listingId }) {
  // data

  const baseMap = useMainBaseMap();
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listingId,
    sortByLabel: true,
  });
  const annotationTemplateCountById = useAnnotationTemplateCountById({ filterByBaseMapId: baseMap?.id });
  const annotationTemplateQtiesById = useAnnotationTemplateQtiesById({ filterByBaseMapId: baseMap?.id });

  // state

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // render

  return (
    <Box>
      <List dense disablePadding>
        {annotationTemplates?.map((template) => {
          if (template?.isDivider) return null;
          const count =
            annotationTemplateCountById?.[template.id] || 0;
          const qtyLabel =
            annotationTemplateQtiesById?.[template.id]?.mainQtyLabel;
          return (
            <AnnotationTemplateRow
              key={template.id}
              annotationTemplate={template}
              count={count}
              qtyLabel={qtyLabel}
              listingId={listingId}
            />
          );
        })}
      </List>

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
}) {
  const dispatch = useDispatch();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isHidden = hiddenListingsIds?.includes(listing.id);

  // handlers

  function handleToggleVisibility(e) {
    e.stopPropagation();
    const next = isHidden
      ? hiddenListingsIds.filter((id) => id !== listing.id)
      : [...hiddenListingsIds, listing.id];
    dispatch(setHiddenListingsIds(next));
  }

  function handleListingClick() {
    onToggleExpand(listing.id);
    dispatch(setSelectedListingId(listing.id));
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

        {/* Right side: count (default) / visibility icon (hover) */}
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

      {isExpanded && <AnnotationTemplatesForListing listingId={listing.id} />}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PopperDrawingHelper — floating panel shown while drawing
// ---------------------------------------------------------------------------

// Modes that select existing geometry — no smart detect needed
const SEGMENT_SELECT_MODES = ["TECHNICAL_RETURN", "CUT_SEGMENT", "SPLIT_POLYLINE"];

function PopperDrawingHelper() {
  // strings

  const titleS = "Mode dessin";

  // data

  const enabledDrawingMode = useSelector(
    (s) => s.mapEditor.enabledDrawingMode
  );
  const isSegmentSelectMode = SEGMENT_SELECT_MODES.includes(enabledDrawingMode);

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

      {!isSegmentSelectMode && <SectionSmartDetect />}

      <Box sx={{ p: 1 }}>
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
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const baseMap = useMainBaseMap();

  const annotationCountByListingId = useLiveQuery(
    async () => {
      if (!baseMap?.id) return {};
      const annotations = await db.annotations
        .where("baseMapId")
        .equals(baseMap.id)
        .toArray();
      return annotations
        .filter((a) => !a.deletedAt && !a.isBaseMapAnnotation)
        .reduce((acc, a) => {
          if (a.listingId) {
            acc[a.listingId] = (acc[a.listingId] || 0) + 1;
          }
          return acc;
        }, {});
    },
    [baseMap?.id, annotationsUpdatedAt]
  );

  const titleS = isBaseMapsViewer
    ? "Dessins sur fond de plan"
    : "Repérages";

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    ...(isBaseMapsViewer
      ? { filterByIsForBaseMaps: true }
      : { excludeIsForBaseMaps: true }),
  });

  // state

  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const comesFromListing = viewerReturnContext?.fromViewer === "LISTING";
  const [expandedListingIds, setExpandedListingIds] = useState([]);
  const [openCreateListing, setOpenCreateListing] = useState(false);
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

  // handlers

  function handleToggleExpand(listingId) {
    setExpandedListingIds((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId]
    );
  }

  // render

  if (Boolean(enabledDrawingMode)) {
    return <PopperDrawingHelper />;
  }

  if (isBaseMapsViewer && !showMapListingsPanel) return null;


  return (
    <Paper
      elevation={4}
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 10,
        width: 290,
        maxHeight: "calc(100% - 32px)",
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
          sx={{ fontWeight: 600, color: "panel.textPrimary", flex: 1 }}
        >
          {titleS}
        </Typography>

        {/* + Liste button in header */}
        {!comesFromListing && !isBaseMapsViewer && (
          <Box
            component="button"
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
      </Box>

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
          {/* Default height (MAP viewer only) */}
          {viewerKey === "MAP" && (
            <Box sx={{ px: 1, py: 1, borderBottom: "1px solid", borderColor: "panel.border" }}>
              <SectionDefaultHeight />
            </Box>
          )}

          {/* Scrollable listings */}
          <Box sx={{ overflow: "auto", flex: 1 }}>
            {viewerKey === "MAP" && <SectionLayers baseMapId={baseMap?.id} />}

            {isBaseMapsViewer
              ? displayedListings?.map((listing) => (
                  <AnnotationTemplatesForListing
                    key={listing.id}
                    listingId={listing.id}
                  />
                ))
              : displayedListings?.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    isExpanded={expandedListingIds.includes(listing.id)}
                    onToggleExpand={handleToggleExpand}
                    hiddenListingsIds={hiddenListingsIds}
                    annotationCount={
                      annotationCountByListingId?.[listing.id] || 0
                    }
                  />
                ))}

            {/* Outils section */}
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
          </Box>
        </>
      )}

      {/* Create listing dialog */}
      {openCreateListing && (
        <DialogCreateListing
          open={openCreateListing}
          onClose={() => setOpenCreateListing(false)}
          isForBaseMaps={isBaseMapsViewer}
        />
      )}
    </Paper>
  );
}
