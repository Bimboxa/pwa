import { useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  Box,
  Typography,
} from "@mui/material";

export default function DialogDeleteLayer({
  open,
  onClose,
  layer,
  otherLayers,
  annotationCount,
  onConfirm,
}) {
  // state

  const [mode, setMode] = useState("MOVE_TO_LAYER");
  const [targetLayerId, setTargetLayerId] = useState(null);

  // handlers

  const handleConfirm = () => {
    onConfirm({
      layerId: layer.id,
      mode,
      targetLayerId: mode === "MOVE_TO_LAYER" ? targetLayerId : undefined,
    });
    onClose();
  };

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1rem", fontWeight: 600 }}>
        Supprimer le calque « {layer?.name} » ?
      </DialogTitle>

      <DialogContent>
        {annotationCount > 0 ? (
          <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
            <FormControlLabel
              value="DELETE_ANNOTATIONS"
              control={<Radio size="small" />}
              label={
                <Typography variant="body2">
                  Supprimer les {annotationCount} annotation
                  {annotationCount > 1 ? "s" : ""} du calque
                </Typography>
              }
            />
            <FormControlLabel
              value="MOVE_TO_LAYER"
              control={<Radio size="small" />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2">
                    Déplacer les annotations vers
                  </Typography>
                </Box>
              }
            />
            {mode === "MOVE_TO_LAYER" && (
              <Select
                value={targetLayerId ?? ""}
                onChange={(e) =>
                  setTargetLayerId(e.target.value || null)
                }
                size="small"
                displayEmpty
                sx={{ ml: 4, mt: 0.5 }}
              >
                <MenuItem value="">Calque 0</MenuItem>
                {otherLayers?.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </RadioGroup>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Ce calque ne contient aucune annotation.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} size="small">
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          size="small"
        >
          Supprimer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
