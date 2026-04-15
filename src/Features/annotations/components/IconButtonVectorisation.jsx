import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useVectorisation from "Features/smartDetect/hooks/useVectorisation";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import {
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  Tooltip,
  Typography,
} from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconVectorisation from "Features/icons/IconVectorisation";

export default function IconButtonVectorisation({ annotations, accentColor }) {
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const vectorise = useVectorisation();
  const baseMap = useMainBaseMap();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enableExteriorOrtho, setEnableExteriorOrtho] = useState(true);
  const [enableExteriorClose, setEnableExteriorClose] = useState(true);
  const [enableInterior, setEnableInterior] = useState(true);
  const [polygonAsFillMode, setPolygonAsFillMode] = useState(false);
  const open = Boolean(anchorEl);

  // data

  const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
  const disabled = !meterByPx || meterByPx <= 0;

  const vectorisationTemplates = allTemplates?.filter((t) => {
    if (resolveDrawingShape(t) !== "POLYLINE") return false;
    const overrides = Array.isArray(t.overrideFields) ? t.overrideFields : [];
    if (overrides.includes("strokeWidth")) return false;
    if (t.strokeWidthUnit !== "CM") return false;
    return true;
  });

  // handlers

  function handleOpen(event) { setAnchorEl(event.currentTarget); }
  function handleClose() { setAnchorEl(null); }

  async function handleTemplateChange(annotationTemplateId) {
    const template = allTemplates?.find((t) => t.id === annotationTemplateId);
    if (!template) return;
    setLoading(true);
    try {
      const result = await vectorise({ annotations, annotationTemplate: template, enableExteriorOrtho, enableExteriorClose, enableInterior, polygonAsFillMode });
      console.log(`[Vectorisation] ${result.count} wall annotations created`);
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
      <Tooltip title={disabled ? "Échelle requise pour la vectorisation" : "Vectoriser les murs"}>
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={disabled || loading}
            sx={{
              color: "text.disabled",
              "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
            }}
          >
            {loading ? <CircularProgress size={18} /> : <IconVectorisation fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Variante</Typography>
        </Box>
        <Box sx={{ px: 1, pb: 0.5, display: "flex", flexDirection: "column" }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={polygonAsFillMode} onChange={(e) => setPolygonAsFillMode(e.target.checked)} />}
            label={<Typography variant="caption">Vectoriser le polygone en mur</Typography>}
            sx={{ m: 0 }}
          />
        </Box>
        <Divider />
        <Box sx={{ px: 2, pt: 1, pb: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Vectorisation</Typography>
        </Box>
        <Box sx={{ px: 1, pb: 0.5, display: "flex", flexDirection: "column" }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={enableExteriorOrtho} disabled={polygonAsFillMode} onChange={(e) => setEnableExteriorOrtho(e.target.checked)} />}
            label={<Typography variant="caption">Murs ext (ortho)</Typography>}
            sx={{ m: 0 }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={enableExteriorClose} disabled={polygonAsFillMode} onChange={(e) => setEnableExteriorClose(e.target.checked)} />}
            label={<Typography variant="caption">Murs ext (fermeture)</Typography>}
            sx={{ m: 0 }}
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={enableInterior} disabled={polygonAsFillMode} onChange={(e) => setEnableInterior(e.target.checked)} />}
            label={<Typography variant="caption">Murs intérieurs ortho</Typography>}
            sx={{ m: 0 }}
          />
        </Box>
        {vectorisationTemplates?.length > 0 ? (
          <SelectorAnnotationTemplateVariantDense
            selectedAnnotationTemplateId={null}
            onChange={handleTemplateChange}
            annotationTemplates={vectorisationTemplates}
            listings={listings}
          />
        ) : (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Aucun template polyline éligible (strokeWidth non verrouillé, unité CM)
            </Typography>
          </Box>
        )}
      </Menu>
    </>
  );
}
