import { useState } from "react";

import useVectorisation from "Features/smartDetect/hooks/useVectorisation";
import useTraceInteriorContours from "Features/smartDetect/hooks/useTraceInteriorContours";
import useVectoriseWallsAsPolylines from "Features/smartDetect/hooks/useVectoriseWallsAsPolylines";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import {
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { VECTORISE_TYPES } from "./vectoriseCommand";

// Toolbar button of « Vectoriser les murs » (commandsToolbar): menu with the
// variant / detection options, the interior-contour switch and the template
// picker (polyline templates with a CM stroke width not locked, or polygon
// templates in interior-contour mode).
export default function ButtonVectorise({ command, ctx, state, hotkeyLabel }) {
  const annotations = getTargets(ctx, VECTORISE_TYPES);
  const vectorise = useVectorisation();
  const traceInteriorContours = useTraceInteriorContours();
  const vectoriseAsPolylines = useVectoriseWallsAsPolylines();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enableExteriorOrtho, setEnableExteriorOrtho] = useState(true);
  const [enableExteriorClose, setEnableExteriorClose] = useState(true);
  const [enableInterior, setEnableInterior] = useState(true);
  const [polygonAsFillMode, setPolygonAsFillMode] = useState(false);
  const [polylineVariantMode, setPolylineVariantMode] = useState(false);
  const [isInteriorContourMode, setIsInteriorContourMode] = useState(false);
  const open = Boolean(anchorEl);

  // helpers

  const isVectorisationTemplate = (t) => {
    if (resolveDrawingShape(t) !== "POLYLINE") return false;
    const overrides = Array.isArray(t.overrideFields) ? t.overrideFields : [];
    if (overrides.includes("strokeWidth")) return false;
    if (t.strokeWidthUnit !== "CM") return false;
    return true;
  };
  const isInteriorContourTemplate = (t) => resolveDrawingShape(t) === "POLYGON";
  const filterTemplate = isInteriorContourMode
    ? isInteriorContourTemplate
    : isVectorisationTemplate;
  const emptyText = isInteriorContourMode
    ? "Aucun template polygone disponible"
    : "Aucun template polyline éligible (strokeWidth non verrouillé, unité CM)";

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
  }
  function handleClose() {
    setAnchorEl(null);
  }

  async function handleTemplateChange(annotationTemplateId, template) {
    console.log(
      `[Vectorisation] handleTemplateChange templateId=${annotationTemplateId} mode=${isInteriorContourMode ? "interiorContour" : "wall"} annotations=${annotations?.length}`
    );
    if (!template) {
      console.warn("[Vectorisation] template not found");
      return;
    }
    setLoading(true);
    try {
      if (isInteriorContourMode) {
        const result = await traceInteriorContours({
          annotations,
          annotationTemplate: template,
        });
        console.log(
          `[Vectorisation] ${result.count} interior contour polygons created`
        );
      } else if (polylineVariantMode) {
        const result = await vectoriseAsPolylines({
          annotations,
          annotationTemplate: template,
        });
        console.log(`[Vectorisation] ${result.count} polyline walls created`);
      } else {
        const result = await vectorise({
          annotations,
          annotationTemplate: template,
          enableExteriorOrtho,
          enableExteriorClose,
          enableInterior,
          polygonAsFillMode,
        });
        console.log(`[Vectorisation] ${result.count} wall annotations created`);
      }
    } catch (e) {
      console.error("[Vectorisation]", e);
    } finally {
      setLoading(false);
      handleClose();
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={loading ? undefined : command.Icon}
        icon={loading ? <CircularProgress size={18} /> : undefined}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, enabled: state.enabled && !loading, active: open }}
        onClick={handleOpen}
      />

      <MenuPickAnnotationTemplate
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        filterTemplate={filterTemplate}
        onChange={handleTemplateChange}
        emptyText={emptyText}
      >
        {!isInteriorContourMode && (
          <Box sx={{ px: 2, pt: 1, pb: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Variante
            </Typography>
          </Box>
        )}
        {!isInteriorContourMode && (
          <Box
            sx={{ px: 1, pb: 0.5, display: "flex", flexDirection: "column" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={polygonAsFillMode}
                  disabled={polylineVariantMode}
                  onChange={(e) => setPolygonAsFillMode(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">
                  Vectoriser le polygone en mur
                </Typography>
              }
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={polylineVariantMode}
                  disabled={polygonAsFillMode}
                  onChange={(e) => setPolylineVariantMode(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">
                  Vectorisation avec polyligne
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Box>
        )}
        {!isInteriorContourMode && <Divider />}
        {!isInteriorContourMode && (
          <Box sx={{ px: 2, pt: 1, pb: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Vectorisation
            </Typography>
          </Box>
        )}
        {!isInteriorContourMode && (
          <Box
            sx={{ px: 1, pb: 0.5, display: "flex", flexDirection: "column" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={enableExteriorOrtho}
                  disabled={polygonAsFillMode || polylineVariantMode}
                  onChange={(e) => setEnableExteriorOrtho(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">Murs ext (ortho)</Typography>
              }
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={enableExteriorClose}
                  disabled={polygonAsFillMode || polylineVariantMode}
                  onChange={(e) => setEnableExteriorClose(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">Murs ext (fermeture)</Typography>
              }
              sx={{ m: 0 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={enableInterior}
                  disabled={polygonAsFillMode || polylineVariantMode}
                  onChange={(e) => setEnableInterior(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">Murs intérieurs ortho</Typography>
              }
              sx={{ m: 0 }}
            />
          </Box>
        )}

        <Divider />
        <Box sx={{ px: 2, pt: 1, pb: 0.5, bgcolor: "action.hover" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={isInteriorContourMode}
                onChange={(e) => setIsInteriorContourMode(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Contour intérieur
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Box>
      </MenuPickAnnotationTemplate>
    </>
  );
}
