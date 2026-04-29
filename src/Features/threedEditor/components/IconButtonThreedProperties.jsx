import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Button,
  Card,
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

import { setShowGrid } from "Features/threedEditor/threedEditorSlice";
import DialogExportPhotoreal from "Features/photorealRender/components/DialogExportPhotoreal";

export default function IconButtonThreedProperties() {
  const dispatch = useDispatch();

  const [anchorEl, setAnchorEl] = useState(null);
  const [exportPreset, setExportPreset] = useState(null);

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
