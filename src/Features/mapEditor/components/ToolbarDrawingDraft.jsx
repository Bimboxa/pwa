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
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import {
  getDrawingToolByKey,
  getDrawingToolsByShape,
  getDrawingToolsByType,
  getDrawingToolTypeByKey,
} from "../constants/drawingTools.jsx";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

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

  const overrideFields = newAnnotation?.overrideFields;
  const isFieldOverridden = (field) =>
    Array.isArray(overrideFields) && overrideFields.includes(field);

  // The Rampe tool drives its own geometry from two transient meter fields
  // (largeur / delta H) stored in mapEditorSlice — it hides the generic
  // height / offset / thickness fields, which don't apply to a ramp.
  const isRampTool = enabledDrawingMode === "RAMP";

  const showColor = !isCuttingTool && !isFieldOverridden(colorField);
  const showThickness =
    !isCuttingTool &&
    !isRampTool &&
    drawingShape === "POLYLINE" &&
    !isFieldOverridden("strokeWidth");
  const showOffset =
    !isCuttingTool && !isRampTool && !isFieldOverridden("offsetZ");
  const showHeight =
    !isCuttingTool && !isRampTool && !isFieldOverridden("height");
  const showAnyField = showThickness || showOffset || showHeight || isRampTool;

  const tools = isCuttingTool
    ? getDrawingToolsByType(toolType)
    : drawingShape
      ? getDrawingToolsByShape(drawingShape)
      : [];
  const options = tools.map(({ key, label, Icon }) => ({
    key,
    label,
    icon: <Icon sx={isCuttingTool ? undefined : { color }} />,
  }));
  const showShape = options.length > 0;

  const colorPopoverTitle = isStrokeColor
    ? "Couleur de tracé"
    : "Couleur de remplissage";

  // handlers

  function handleToolChange(mode) {
    dispatch(setEnabledDrawingMode(mode));
    const tool = getDrawingToolByKey(mode);
    if (tool?.annotationType) {
      dispatch(
        setNewAnnotation({ ...newAnnotation, type: tool.annotationType })
      );
    }
    // Keep the popper's per-tool active-mode highlight in sync when the mode is
    // switched from the toolbar (mirrors ToolRow.handleSelectTool).
    if (isCuttingTool && mode) {
      dispatch(
        setSelectedToolKeyForTemplate({ templateId: toolType, toolKey: mode })
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
            selectedKey={enabledDrawingMode}
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
