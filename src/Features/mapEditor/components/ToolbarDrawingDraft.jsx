import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  Paper,
  Box,
  ButtonBase,
  Divider,
  Popover,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
  setRampWidthM,
  setRampDeltaHM,
  setOpeningStrokeWidth,
  setDraftPropsForTemplate,
  clearDrawingPolylinePoints,
  clearDrawingRectanglePoints,
  clearDrawingSegmentPoints,
  clearRectDims,
  clearConstraintBuffer,
  setRectHasFirstPoint,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { cancelInProgressPolyline } from "Features/threedEditor/threedEditorSlice";
import { REMEMBERABLE_DRAFT_KEYS } from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";

import {
  getDrawingToolByKey,
  getDrawingToolsByShape,
  getDrawingToolsByType,
} from "../constants/drawingTools.jsx";
import getDraftFieldVisibility from "../utils/getDraftFieldVisibility";
import {
  getHotkeyForToolInGroup,
  getOpeningHotkeyForTool,
} from "../constants/drawingToolHotkeys";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import {
  getDraftSessionKey,
  isTemplatelessAnnotation,
} from "Features/annotations/utils/templatelessAnnotations";
import TEMPLATELESS_DRAWING_SHAPES from "Features/annotations/constants/templatelessDrawingShapes.jsx";
import { FREE_TEXT_DEFAULT_TEXT_COLOR } from "Features/annotations/constants/freeTextConstants";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";
import buildToolDraft from "Features/mapEditor/utils/buildToolDraft";
import { selectIsTemplateCoteDrawActive } from "Features/threedDrawing/utils/templateCoteDrawSelectors";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import FieldAnnotationThickness from "Features/annotations/components/FieldAnnotationThickness";
import FieldAnnotationFontSizeInline from "Features/annotations/components/FieldAnnotationFontSizeInline";
import FieldCheck from "Features/form/components/FieldCheck";
import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";

import theme from "Styles/theme";

export default function ToolbarDrawingDraft() {
  const dispatch = useDispatch();

  // strings

  const shapeMenuTitleS = "Type d'annotation";
  const changeShapeS = "Changer de type d'annotation";
  const drawS = "Dessiner";
  const paintS = "Peindre avec";

  // state

  const [colorAnchorEl, setColorAnchorEl] = useState(null);
  const [shapeMenuAnchorEl, setShapeMenuAnchorEl] = useState(null);

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const drawingShape = newAnnotation?.drawingShape;
  const rampWidthM = useSelector((s) => s.mapEditor.rampWidthM);
  const rampDeltaHM = useSelector((s) => s.mapEditor.rampDeltaHM);
  const selectedCutToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId?.CUT
  );
  const openingStrokeWidth = useSelector((s) => s.mapEditor.openingStrokeWidth);
  const openingStrokeWidthUnit = useSelector(
    (s) => s.mapEditor.openingStrokeWidthUnit
  );
  // Which field the E / H typed-entry machine is currently editing (highlights
  // the matching toolbar field).
  const metricInputField = useSelector((s) => s.mapEditor.metricInputField);
  // Template-driven 3D cote keeps the 2D drawing state armed while the 3D
  // dimension mode runs — CoteToolbarThreed owns the bottom UI there.
  const isTemplateCoteDraw3d = useSelector(selectIsTemplateCoteDrawActive);
  // "3D" in the Dessin module's 3D editor: the tool toggle then offers the
  // 3D-only tools (« Pinceau ») — same list as the template row's picker.
  const toolsEditor = useSelector(selectDrawingToolsEditor);
  // Drawn template ("Dessiner …" block) — mirrors ToolbarStartDrawTemplate so
  // arming a draw from it doesn't shift the toolbar. Absent for tool groups
  // (openings / splits), which carry no template.
  const annotationTemplates = useAnnotationTemplates();
  const drawnTemplate = annotationTemplates?.find(
    (t) => t.id === newAnnotation?.annotationTemplateId
  );

  // Templateless draw ("Dessin" tool): the block shows the annotation type;
  // the menu lists the types of the displayed editor (lines and surfaces in
  // 3D).
  const { shapes: templatelessShapes, selectShapeAndDraw } =
    useDrawTemplateless();
  const templatelessShape =
    !drawnTemplate && isTemplatelessAnnotation(newAnnotation)
      ? TEMPLATELESS_DRAWING_SHAPES.find((shape) => shape.key === drawingShape)
      : null;

  // helpers

  // FREE_TEXT: the toolbar colour is the text colour (fillColor is the box
  // background, edited from the properties panel).
  const isFreeText = newAnnotation?.type === "FREE_TEXT";
  const color = isFreeText
    ? (newAnnotation.textColor ?? FREE_TEXT_DEFAULT_TEXT_COLOR)
    : (getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main);
  const shapeCategory = drawingShape
    ? resolveShapeCategory(drawingShape)
    : null;
  // REVOLUTION_AXIS is a "circle" shape but only exposes a stroke colour.
  const isStrokeColor =
    shapeCategory === "polyline" || drawingShape === "REVOLUTION_AXIS";
  const colorField = isFreeText
    ? "textColor"
    : isStrokeColor
      ? "strokeColor"
      : "fillColor";

  // Field visibility + tool-group flags for the current draft. Shared with the
  // E / H keyboard shortcuts (InteractionLayer) via getDraftFieldVisibility so
  // the shortcuts stay in lockstep with the fields actually shown here.
  const {
    isToolGroup,
    toolGroupType,
    isRampTool,
    isMeshBrushTool,
    isOpeningBand,
    isFieldOverridden,
    showThickness,
    showOffset,
    showHeight,
    showWidth,
    showIsLayer,
    showFontSize,
  } = getDraftFieldVisibility(newAnnotation, enabledDrawingMode);

  // « Pinceau »: the paint takes the template's own colour, the draft colour
  // would be a dead control.
  const showColor =
    !isToolGroup && !isMeshBrushTool && !isFieldOverridden(colorField);
  const showAnyField =
    showThickness ||
    showOffset ||
    showHeight ||
    showWidth ||
    showIsLayer ||
    showFontSize ||
    isRampTool;

  // Shape groups: the tools of the editor shown, minus those needing a
  // template for a template-less draft ("Dessin" tool).
  const tools = toolGroupType
    ? getDrawingToolsByType(toolGroupType)
    : drawingShape
      ? getDrawingToolsByShape(drawingShape, {
          editor: toolsEditor,
          templateless: !newAnnotation?.annotationTemplateId,
        })
      : [];
  const options = tools.map((tool) => {
    const { key, label, Icon } = tool;
    // Hotkey badges: the opening (CUT) group has its own S/R/L/B direct-access
    // letters; other tool groups (SPLIT, …) get no badge; the shape groups use
    // the behavior-based direct-access letters.
    const hotkey =
      toolGroupType === "CUT"
        ? getOpeningHotkeyForTool(tool)
        : isToolGroup
          ? null
          : getHotkeyForToolInGroup(tool, tools);
    return {
      key,
      label,
      icon: (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Icon sx={isToolGroup ? undefined : { color }} />
          {hotkey && (
            <Box
              sx={{
                position: "absolute",
                bottom: -7,
                right: -8,
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
              {hotkey}
            </Box>
          )}
        </Box>
      ),
    };
  });
  const showShape = options.length > 0;
  // Highlight the active variant: for centerline opening tools the enabled mode
  // is POLYLINE_CLICK / STRIP / … so the toggle tracks the persisted CUT tool
  // key instead.
  const selectedToolKey = isOpeningBand
    ? (selectedCutToolKey ?? enabledDrawingMode)
    : enabledDrawingMode;

  const colorPopoverTitle = isFreeText
    ? "Couleur du texte"
    : isStrokeColor
      ? "Couleur de tracé"
      : "Couleur de remplissage";

  // handlers

  function handleToolChange(mode) {
    const tool = getDrawingToolByKey(mode);
    // Opening tools reuse an underlying interaction mode (tool.drawingMode);
    // fall back to the key for regular tools.
    dispatch(setEnabledDrawingMode(tool?.drawingMode ?? mode));
    if (tool?.annotationType) {
      dispatch(
        setNewAnnotation(
          buildToolDraft(newAnnotation, tool, {
            strokeWidth: openingStrokeWidth,
            strokeWidthUnit: openingStrokeWidthUnit,
          })
        )
      );
    }
    // Keep the popper's per-tool active-mode highlight in sync when the mode is
    // switched from the toolbar (mirrors ToolRow.handleSelectTool).
    if (isToolGroup && mode) {
      dispatch(
        setSelectedToolKeyForTemplate({
          templateId: toolGroupType,
          toolKey: tool?.key ?? mode,
        })
      );
    } else if (isTemplatelessAnnotation(newAnnotation) && mode) {
      // "Dessin" tool: remember the drawing mode per annotation type
      dispatch(
        setSelectedToolKeyForTemplate({
          templateId: getDraftSessionKey(newAnnotation),
          toolKey: tool?.key ?? mode,
        })
      );
    }
  }

  function handleOpenColor(e) {
    setColorAnchorEl(e.currentTarget);
  }

  // Persist the whitelisted props just edited so re-arming the same template
  // restores them as defaults (mapEditor.draftPropsByTemplateId).
  function rememberDraftProps(changed) {
    // templateless drafts are remembered per annotation type
    const templateId = getDraftSessionKey(newAnnotation);
    if (!templateId) return;
    const props = {};
    for (const key of REMEMBERABLE_DRAFT_KEYS) {
      if (changed[key] !== undefined) props[key] = changed[key];
    }
    if (Object.keys(props).length > 0) {
      dispatch(setDraftPropsForTemplate({ templateId, props }));
    }
  }

  function handleColorChange(hex) {
    dispatch(setNewAnnotation({ ...newAnnotation, [colorField]: hex }));
    rememberDraftProps({ [colorField]: hex });
  }

  // "Dessin" tool: switch the annotation type without leaving the draw. The
  // new type starts from a clean geometry (like the in-draw tool switch of
  // useDrawingToolHotkeys).
  function handleShapeChange(shape) {
    setShapeMenuAnchorEl(null);
    if (shape.key === drawingShape) return;
    dispatch(clearDrawingPolylinePoints());
    dispatch(clearDrawingRectanglePoints());
    dispatch(clearDrawingSegmentPoints());
    dispatch(clearRectDims());
    dispatch(clearConstraintBuffer());
    dispatch(setRectHasFirstPoint(false));
    // 3D drawing: its in-progress path belongs to the previous type too.
    dispatch(cancelInProgressPolyline());
    selectShapeAndDraw(shape);
  }

  function handleFieldChange(next) {
    dispatch(setNewAnnotation({ ...newAnnotation, ...next }));
    rememberDraftProps(next);
    // Remember the last line width entered while drawing an opening so the next
    // opening tool activation reuses it instead of resetting to the default.
    if (
      isOpeningBand &&
      (next?.strokeWidth != null || next?.strokeWidthUnit != null)
    ) {
      dispatch(
        setOpeningStrokeWidth({
          strokeWidth: next.strokeWidth,
          strokeWidthUnit: next.strokeWidthUnit,
        })
      );
    }
  }

  function handleRampWidthChange(next) {
    dispatch(setRampWidthM(next.rampWidthM));
  }

  function handleRampDeltaHChange(next) {
    dispatch(setRampDeltaHM(next.rampDeltaHM));
  }

  // render

  // MEASURE (mise à l'échelle) always draws a fixed orange 2px polyline —
  // its draft properties must not be editable.
  if (!enabledDrawingMode || enabledDrawingMode === "MEASURE") return null;
  if (isTemplateCoteDraw3d) return null;

  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        borderRadius: 2,
        px: 1,
        py: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        maxWidth: "calc(100vw - 32px)",
        overflowX: "auto",
        zIndex: 110,
      }}
    >
      {drawnTemplate && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
              mr: 0.5,
            }}
          >
            <AnnotationTemplateIcon template={drawnTemplate} size={18} />
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  lineHeight: 1.2,
                  fontSize: "0.65rem",
                }}
              >
                {isMeshBrushTool ? paintS : drawS}
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: 600, lineHeight: 1.2, maxWidth: 160 }}
              >
                {drawnTemplate.label}
              </Typography>
            </Box>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        </>
      )}

      {templatelessShape && (
        <>
          <ButtonBase
            onClick={(e) => setShapeMenuAnchorEl(e.currentTarget)}
            title={changeShapeS}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexShrink: 0,
              mr: 0.5,
              pl: 0.5,
              py: 0.25,
              borderRadius: 1,
              textAlign: "left",
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {templatelessShape.icon}
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  lineHeight: 1.2,
                  fontSize: "0.65rem",
                }}
              >
                Dessiner
              </Typography>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  maxWidth: 160,
                  color: "text.primary",
                }}
              >
                {templatelessShape.label}
              </Typography>
            </Box>
            <ArrowDropDown sx={{ fontSize: 18 }} />
          </ButtonBase>
          <Menu
            anchorEl={shapeMenuAnchorEl}
            open={Boolean(shapeMenuAnchorEl)}
            onClose={() => setShapeMenuAnchorEl(null)}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
            slotProps={{
              paper: {
                sx: {
                  minWidth: 200,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "panel.border",
                  mb: 1,
                },
              },
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: "panel.border",
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "panel.textPrimary" }}
              >
                {shapeMenuTitleS}
              </Typography>
            </Box>
            {templatelessShapes.map((shape) => (
              <MenuItem
                key={shape.key}
                selected={shape.key === drawingShape}
                onClick={() => handleShapeChange(shape)}
                sx={{ gap: 1, py: 0.75 }}
              >
                <ListItemIcon
                  sx={{ minWidth: 28, "& .MuiSvgIcon-root": { fontSize: 18 } }}
                >
                  {shape.icon}
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ variant: "body2" }}>
                  {shape.label}
                </ListItemText>
              </MenuItem>
            ))}
          </Menu>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        </>
      )}

      {showColor && (
        <Box
          onClick={handleOpenColor}
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            flexShrink: 0,
            bgcolor: color,
            cursor: "pointer",
            border: "2px solid",
            borderColor: "divider",
            transition: "transform 0.2s",
            "&:hover": { transform: "scale(1.1)" },
          }}
        />
      )}

      {showShape && (
        <>
          {showColor && (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          )}
          <ToggleSingleSelectorGeneric
            options={options}
            selectedKey={selectedToolKey}
            onChange={handleToolChange}
          />
        </>
      )}

      {showAnyField && (showColor || showShape) && (
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      )}

      {showWidth && (
        <FieldAnnotationHeight
          annotation={newAnnotation}
          onChange={handleFieldChange}
          field="width"
          label="larg."
        />
      )}
      {showThickness && (
        <FieldAnnotationThickness
          annotation={newAnnotation}
          onChange={handleFieldChange}
          active={metricInputField === "strokeWidth"}
          shortcut="E"
        />
      )}
      {showOffset && (
        <FieldAnnotationHeight
          annotation={newAnnotation}
          onChange={handleFieldChange}
          field="offsetZ"
          label="Offset"
        />
      )}
      {showHeight && (
        <FieldAnnotationHeight
          annotation={newAnnotation}
          onChange={handleFieldChange}
          active={metricInputField === "height"}
          shortcut="H"
        />
      )}
      {showFontSize && (
        <FieldAnnotationFontSizeInline
          value={newAnnotation?.fontSize}
          onChange={handleFieldChange}
        />
      )}
      {showIsLayer && (
        <FieldCheck
          value={Boolean(newAnnotation?.isLayer)}
          onChange={(checked) => handleFieldChange({ isLayer: checked })}
          label="Couche"
          options={{ type: "switch", showAsInline: true }}
        />
      )}
      {isRampTool && (
        <>
          <FieldAnnotationHeight
            annotation={{ rampWidthM }}
            onChange={handleRampWidthChange}
            field="rampWidthM"
            label="largeur"
          />
          <FieldAnnotationHeight
            annotation={{ rampDeltaHM }}
            onChange={handleRampDeltaHChange}
            field="rampDeltaHM"
            label="delta H"
          />
        </>
      )}

      <Popover
        open={Boolean(colorAnchorEl)}
        anchorEl={colorAnchorEl}
        onClose={() => setColorAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              mb: 1,
              p: 0,
              overflow: "hidden",
              borderRadius: 2,
              boxShadow: 6,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 2,
            pr: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>
            {colorPopoverTitle}
          </Typography>
          <IconButton size="small" onClick={() => setColorAnchorEl(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <ColorPickerContent
          color={color}
          onColorChange={handleColorChange}
          onClose={() => setColorAnchorEl(null)}
        />
      </Popover>
    </Paper>
  );
}
