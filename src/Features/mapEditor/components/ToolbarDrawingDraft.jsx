import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Paper, Box, Divider, Popover, Typography, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";
import { CompactPicker } from "react-color";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import {
  getDrawingToolByKey,
  getDrawingToolsByShape,
} from "../constants/drawingTools.jsx";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";

import theme from "Styles/theme";

export default function ToolbarDrawingDraft() {
  const dispatch = useDispatch();

  // state

  const [colorAnchorEl, setColorAnchorEl] = useState(null);

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const drawingShape = newAnnotation?.drawingShape;

  // helpers

  const color =
    getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main;
  const shapeCategory = drawingShape ? resolveShapeCategory(drawingShape) : null;
  const isStrokeColor = shapeCategory === "polyline";
  const colorField = isStrokeColor ? "strokeColor" : "fillColor";

  const overrideFields = newAnnotation?.overrideFields;
  const isColorLocked =
    Array.isArray(overrideFields) && overrideFields.includes(colorField);

  const tools = drawingShape ? getDrawingToolsByShape(drawingShape) : [];
  const options = tools.map(({ key, label, Icon }) => ({
    key,
    label,
    icon: <Icon sx={{ color }} />,
  }));

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
  }

  function handleOpenColor(e) {
    if (isColorLocked) return;
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          opacity: isColorLocked ? 0.5 : 1,
        }}
      >
        {isColorLocked ? (
          <LockIcon sx={{ fontSize: 16, color: "action.active" }} />
        ) : (
          <LockOpenIcon sx={{ fontSize: 16, color: "text.disabled" }} />
        )}
        <Box
          onClick={handleOpenColor}
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            bgcolor: color,
            cursor: isColorLocked ? "not-allowed" : "pointer",
            border: "2px solid",
            borderColor: "divider",
            transition: "transform 0.2s",
            "&:hover": isColorLocked ? {} : { transform: "scale(1.1)" },
          }}
        />
      </Box>

      {options.length > 0 && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <ToggleSingleSelectorGeneric
            options={options}
            selectedKey={enabledDrawingMode}
            onChange={handleToolChange}
          />
        </>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <FieldAnnotationHeight
        annotation={newAnnotation}
        onChange={handleFieldChange}
        field="offsetZ"
        label="Offset"
      />
      <FieldAnnotationHeight
        annotation={newAnnotation}
        onChange={handleFieldChange}
      />

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
