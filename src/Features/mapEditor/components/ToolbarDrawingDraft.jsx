import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Paper, Box, Divider, Popover, Typography, IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { CompactPicker } from "react-color";

import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
  setRampWidthM,
  setRampDeltaHM,
  setOpeningStrokeWidth,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import {
  getDrawingToolByKey,
  getDrawingToolsByShape,
  getDrawingToolsByType,
  getDrawingToolTypeByKey,
} from "../constants/drawingTools.jsx";
import { getHotkeyForToolInGroup } from "../constants/drawingToolHotkeys";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";
import buildToolDraft from "Features/mapEditor/utils/buildToolDraft";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import FieldAnnotationThickness from "Features/annotations/components/FieldAnnotationThickness";

import theme from "Styles/theme";

export default function ToolbarDrawingDraft() {
  const dispatch = useDispatch();

  // state

  const [colorAnchorEl, setColorAnchorEl] = useState(null);

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

  // helpers

  const color =
    getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main;
  const shapeCategory = drawingShape ? resolveShapeCategory(drawingShape) : null;
  const isStrokeColor = shapeCategory === "polyline";
  const colorField = isStrokeColor ? "strokeColor" : "fillColor";

  // A cutting tool (CUT / SPLIT_LINE / …) is active when the enabled drawing
  // mode maps back to one of the DRAWING_TOOLS_BY_TYPE groups. In that case the
  // toolbar shows the available modes for the tool instead of the
  // new-annotation color / height fields, which are not relevant.
  const toolType = getDrawingToolTypeByKey(enabledDrawingMode);
  const isCuttingTool = Boolean(toolType);

  // Opening (ouverture) tools drawn from a centerline reuse the POLYLINE / STRIP
  // interaction modes, so `enabledDrawingMode` is not a CUT_* key — they're
  // recognized via the draft's `isOpening` flag instead. We still surface the
  // "Ouverture" variant toggle (group "CUT") and show the line-width field for
  // them, while hiding the per-annotation colour (openings are forced red).
  const isOpeningBand =
    Boolean(newAnnotation?.isOpening) &&
    (newAnnotation?.type === "POLYLINE" || newAnnotation?.type === "STRIP");
  const isToolGroup = isCuttingTool || isOpeningBand;
  const toolGroupType = isCuttingTool ? toolType : isOpeningBand ? "CUT" : null;

  const overrideFields = newAnnotation?.overrideFields;
  const isFieldOverridden = (field) =>
    Array.isArray(overrideFields) && overrideFields.includes(field);

  // The Rampe tool drives its own geometry from two transient meter fields
  // (largeur / delta H) stored in mapEditorSlice — it hides the generic
  // height / offset / thickness fields, which don't apply to a ramp.
  const isRampTool = enabledDrawingMode === "RAMP";

  const showColor = !isToolGroup && !isFieldOverridden(colorField);
  const showThickness =
    !isRampTool &&
    !isFieldOverridden("strokeWidth") &&
    ((!isToolGroup && drawingShape === "POLYLINE") || isOpeningBand);
  const showOffset =
    !isToolGroup && !isRampTool && !isFieldOverridden("offsetZ");
  const showHeight =
    !isToolGroup && !isRampTool && !isFieldOverridden("height");
  const showAnyField = showThickness || showOffset || showHeight || isRampTool;

  const tools = toolGroupType
    ? getDrawingToolsByType(toolGroupType)
    : drawingShape
      ? getDrawingToolsByShape(drawingShape)
      : [];
  const options = tools.map((tool) => {
    const { key, label, Icon } = tool;
    // Hotkey badges only apply to the shape tool group (direct-access letters),
    // not to cutting-tool variants.
    const hotkey = isToolGroup ? null : getHotkeyForToolInGroup(tool, tools);
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

  const colorPopoverTitle = isStrokeColor
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
    }
  }

  function handleOpenColor(e) {
    setColorAnchorEl(e.currentTarget);
  }

  function handleColorChange(picked) {
    dispatch(
      setNewAnnotation({ ...newAnnotation, [colorField]: picked.hex })
    );
  }

  function handleFieldChange(next) {
    dispatch(setNewAnnotation({ ...newAnnotation, ...next }));
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

  if (!enabledDrawingMode) return null;

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
      {showColor && (
        <Box
          onClick={handleOpenColor}
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
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

      {showThickness && (
        <FieldAnnotationThickness
          annotation={newAnnotation}
          onChange={handleFieldChange}
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
        <Box sx={{ p: 1 }}>
          <CompactPicker color={color} onChange={handleColorChange} />
        </Box>
      </Popover>
    </Paper>
  );
}
