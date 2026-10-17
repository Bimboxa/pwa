import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActiveLayerId } from "Features/layers/layersSlice";

import useConvertAnnotationsToPolyline from "Features/annotations/hooks/useConvertAnnotationsToPolyline";
import useLayers from "Features/layers/hooks/useLayers";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import LayersIcon from "@mui/icons-material/Layers";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { CONVERT_TYPES } from "./convertCommand";

// Toolbar button of « Transformer » (commandsToolbar): menu with the options,
// the target layer and the polyline template picker.
export default function ButtonConvert({ command, ctx, state, hotkeyLabel }) {
  const dispatch = useDispatch();

  // data

  const annotations = getTargets(ctx, CONVERT_TYPES);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const convertToPolyline = useConvertAnnotationsToPolyline();
  const layers = useLayers({
    filterByBaseMapId: ctx.baseMap?.id,
    filterByScopeId: selectedScopeId,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [keepCuts, setKeepCuts] = useState(false);
  const [explodeSegments, setExplodeSegments] = useState(false);
  const [layerAnchorEl, setLayerAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const filterPolylineTemplate = (t) => resolveDrawingShape(t) === "POLYLINE";

  const activeLayer = activeLayerId
    ? layers?.find((l) => l.id === activeLayerId)
    : null;
  const activeLayerLabel = activeLayer?.name ?? "Calque 0";

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleLayerMenuOpen(event) {
    event.stopPropagation();
    setLayerAnchorEl(event.currentTarget);
  }

  function handleLayerMenuClose() {
    setLayerAnchorEl(null);
  }

  function handleLayerSelect(layerId) {
    dispatch(setActiveLayerId(layerId));
    handleLayerMenuClose();
  }

  async function handleTemplateChange(annotationTemplateId) {
    try {
      await convertToPolyline({
        annotations,
        annotationTemplateId,
        keepCuts,
        explodeSegments,
      });
    } catch (e) {
      console.error("[convertAnnotationsToPolyline]", e);
    } finally {
      handleClose();
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={handleOpen}
      />

      <MenuPickAnnotationTemplate
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        filterTemplate={filterPolylineTemplate}
        onChange={handleTemplateChange}
      >
        {/* Title */}
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Surface → Ligne
          </Typography>
        </Box>

        {/* Options & Layer section */}
        <Box sx={{ bgcolor: "background.default", p: 2 }}>
          <Box
            sx={{
              bgcolor: "background.paper",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            {/* Checkboxes */}
            <Box sx={{ px: 1.5, py: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={keepCuts}
                    onChange={(e) => setKeepCuts(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">Garder les ouvertures</Typography>
                }
                sx={{ ml: -0.5 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={explodeSegments}
                    onChange={(e) => setExplodeSegments(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">Éclater les segments</Typography>
                }
                sx={{ ml: -0.5 }}
              />
            </Box>

            <Divider />

            {/* Layer selector */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 1.5,
                py: 0.75,
                gap: 0.5,
              }}
            >
              <LayersIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 600 }}
              >
                Calque
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Box
                onClick={handleLayerMenuOpen}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.25,
                  cursor: "pointer",
                  borderRadius: 1,
                  px: 0.75,
                  py: 0.25,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {activeLayerLabel}
                </Typography>
                <ArrowDropDownIcon sx={{ fontSize: 18 }} />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Layer dropdown menu */}
        <Menu
          open={Boolean(layerAnchorEl)}
          anchorEl={layerAnchorEl}
          onClose={handleLayerMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            dense
            selected={!activeLayerId}
            onClick={() => handleLayerSelect(null)}
          >
            {!activeLayerId && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={Boolean(activeLayerId)}>Calque 0</ListItemText>
          </MenuItem>
          {layers?.map((layer) => {
            const isSelected = activeLayerId === layer.id;
            return (
              <MenuItem
                key={layer.id}
                dense
                selected={isSelected}
                onClick={() => handleLayerSelect(layer.id)}
              >
                {isSelected && (
                  <ListItemIcon>
                    <Check fontSize="small" />
                  </ListItemIcon>
                )}
                <ListItemText inset={!isSelected}>{layer.name}</ListItemText>
              </MenuItem>
            );
          })}
        </Menu>

        <Divider sx={{ my: 0.5 }} />
      </MenuPickAnnotationTemplate>
    </>
  );
}
