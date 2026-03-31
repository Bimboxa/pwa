import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from "@mui/material";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { setCalibrationTargets } from "Features/baseMapEditor/baseMapEditorSlice";
import computeCalibrationTransform, {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";

export default function DialogCalibration2D({ open, onClose }) {
  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );

  const versions = baseMap?.versions || [];
  const activeVersion = baseMap?.getActiveVersion();

  const otherVersions = versions.filter(
    (v) => v.id !== activeVersion?.id
  );

  // state

  const [referenceVersionId, setReferenceVersionId] = useState(
    otherVersions[0]?.id || ""
  );

  // handlers

  async function handleCalibrate() {
    if (!activeVersion || !referenceVersionId || !baseMap) return;

    const refVersion = versions.find((v) => v.id === referenceVersionId);
    if (!refVersion) return;

    const activeTargets = calibrationTargetsByVersionId[activeVersion.id] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };
    const refTargets = calibrationTargetsByVersionId[referenceVersionId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };

    const refSize = baseMap.getImageSize();
    if (!refSize) return;

    const activeTransform = activeVersion.transform || {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    };

    const newTransform = computeCalibrationTransform({
      activeTargets,
      refTargets,
      refSize,
      activeTransform,
    });

    if (!newTransform) return;

    await db.baseMapVersions.update(activeVersion.id, {
      transform: newTransform,
    });

    // After calibration, features are aligned — move targets to reference positions
    dispatch(
      setCalibrationTargets({
        versionId: activeVersion.id,
        red: { x: refTargets.red.x, y: refTargets.red.y },
        green: { x: refTargets.green.x, y: refTargets.green.y },
      })
    );

    onClose();
  }

  async function handleReset() {
    if (!activeVersion) return;
    await db.baseMapVersions.update(activeVersion.id, {
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    });
    dispatch(
      setCalibrationTargets({
        versionId: activeVersion.id,
        red: DEFAULT_RED,
        green: DEFAULT_GREEN,
      })
    );
  }

  // render

  if (!activeVersion || otherVersions.length === 0) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Calage 2D</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          La version active ({activeVersion.label || "Sans nom"}) sera recalée
          par rapport à la version de référence ci-dessous. Positionnez les
          cibles rouge et verte sur des points identifiables communs aux deux
          versions.
        </Typography>

        <FormControl fullWidth size="small">
          <InputLabel>Version de référence</InputLabel>
          <Select
            value={referenceVersionId}
            onChange={(e) => setReferenceVersionId(e.target.value)}
            label="Version de référence"
          >
            {otherVersions.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.label || "Sans nom"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: "action.hover",
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Le calage calcule automatiquement la translation et l'échelle à
            appliquer pour aligner les deux versions. La cible rouge sert de
            point d'ancrage pour la translation, la distance entre les deux
            cibles détermine l'échelle.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={handleReset} sx={{ mr: "auto" }}>
          Reset
        </Button>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleCalibrate}
          disabled={!referenceVersionId}
        >
          Caler
        </Button>
      </DialogActions>
    </Dialog>
  );
}
