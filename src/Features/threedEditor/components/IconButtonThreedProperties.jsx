import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Popover,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import Tune from "@mui/icons-material/Tune";
import ViewInAr from "@mui/icons-material/ViewInAr";

import { setShowGrid } from "Features/threedEditor/threedEditorSlice";
import DialogExportPhotoreal from "Features/photorealRender/components/DialogExportPhotoreal";
import exportSceneAsUsdzService from "Features/threedEditor/services/exportSceneAsUsdzService";

export default function IconButtonThreedProperties() {
  const dispatch = useDispatch();

  const [anchorEl, setAnchorEl] = useState(null);
  const [exportPreset, setExportPreset] = useState(null);
  const [usdzExporting, setUsdzExporting] = useState(false);

  const showGrid = useSelector((s) => s.threedEditor.showGrid);

  const open = Boolean(anchorEl);

  function handleOpen(e) {
    setAnchorEl(e.currentTarget);
  }
  function handleClose() {
    setAnchorEl(null);
  }
  function handleStartExport(presetKey) {
    setAnchorEl(null);
    setExportPreset(presetKey);
  }
  function handleCloseExport() {
    setExportPreset(null);
  }
  async function handleDownloadUsdz() {
    if (usdzExporting) return;
    setUsdzExporting(true);
    // Yield to the browser so the spinner gets painted before the heavy
    // synchronous portion of the USDZ encode (texture bitmap reads + zip).
    await new Promise((r) => requestAnimationFrame(r));
    try {
      await exportSceneAsUsdzService("scene.usdz");
    } catch (e) {
      console.error("[IconButtonThreedProperties] USDZ export failed", e);
    } finally {
      setUsdzExporting(false);
    }
  }

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          borderRadius: "8px",
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Tooltip title="Propriétés du viewer 3D">
          <IconButton size="small" onClick={handleOpen} sx={{ borderRadius: "8px" }}>
            <Tune sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Paper>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.5 } } }}
      >
        <Box sx={{ p: 2, width: 340 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Propriétés
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showGrid}
                  onChange={(e) => dispatch(setShowGrid(e.target.checked))}
                />
              }
              label={<Typography variant="body2">Afficher la grille</Typography>}
            />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Télécharger la 3D
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              Export USDZ de la scène (fond de plan + objets 3D avec textures).
            </Typography>
            <Button
              size="small"
              variant="outlined"
              fullWidth
              startIcon={
                usdzExporting ? (
                  <CircularProgress size={14} thickness={5} />
                ) : (
                  <ViewInAr sx={{ fontSize: 16 }} />
                )
              }
              disabled={usdzExporting}
              onClick={handleDownloadUsdz}
            >
              {usdzExporting ? "Export en cours…" : "Télécharger (.usdz)"}
            </Button>
          </Card>

          <Card variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Export photoréaliste
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
              Rendu path-tracing de la vue 3D actuelle. Le fond est transparent
              dans le PNG (pratique pour intégration dans un PDF).
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                onClick={() => handleStartExport("QUICK")}
              >
                Rapide
              </Button>
              <Button
                size="small"
                variant="contained"
                color="secondary"
                fullWidth
                onClick={() => handleStartExport("HIGH")}
              >
                Haute qualité
              </Button>
            </Box>
          </Card>
        </Box>
      </Popover>

      <DialogExportPhotoreal
        presetKey={exportPreset}
        onClose={handleCloseExport}
      />
    </>
  );
}
