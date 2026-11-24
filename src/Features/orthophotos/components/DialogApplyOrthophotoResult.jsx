import { useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";

import { ORTHOPHOTO_RESULT_MODES } from "../services/orthophotoPromptServices";

// Asked before the zip returned by the AI updates a base map that already
// has a mosaic: replace the image of the current version, or keep it and
// create a new version (named "Version N" by default).
export default function DialogApplyOrthophotoResult({
  open,
  activeLabel,
  nextLabel,
  photosCount,
  onCancel,
  onConfirm,
}) {
  // strings

  const titleS = "Mettre à jour l'orthophoto";
  const introS = `Le zip contient une mosaïque et ${photosCount} orthophoto(s). Le fond de plan a déjà une image :`;
  const replaceS = activeLabel
    ? `Remplacer la version en cours (« ${activeLabel} »)`
    : "Remplacer la version en cours";
  const replaceHelpS = "L'image actuelle est perdue.";
  const newVersionS = "Créer une nouvelle version";
  const newVersionHelpS =
    "La version en cours est conservée, la nouvelle devient active.";
  const nameS = "Nom de la version";
  const cancelS = "Annuler";
  const applyS = "Appliquer";

  // state

  const [mode, setMode] = useState(ORTHOPHOTO_RESULT_MODES.NEW_VERSION);
  const [label, setLabel] = useState("");

  // helpers

  const isNewVersion = mode === ORTHOPHOTO_RESULT_MODES.NEW_VERSION;

  // handlers

  function handleConfirm() {
    onConfirm({
      mode,
      versionLabel: isNewVersion ? label.trim() || nextLabel : null,
    });
  }

  // render

  if (!open) return null;

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {introS}
        </Typography>
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
          <FormControlLabel
            value={ORTHOPHOTO_RESULT_MODES.NEW_VERSION}
            control={<Radio size="small" />}
            label={
              <>
                <Typography variant="body2">{newVersionS}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {newVersionHelpS}
                </Typography>
              </>
            }
            sx={{ alignItems: "flex-start", mb: 0.5 }}
          />
          {isNewVersion && (
            <TextField
              size="small"
              label={nameS}
              value={label}
              placeholder={nextLabel}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              sx={{ ml: 3.5, mt: 1, mb: 1.5 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
          <FormControlLabel
            value={ORTHOPHOTO_RESULT_MODES.REPLACE}
            control={<Radio size="small" />}
            label={
              <>
                <Typography variant="body2">{replaceS}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {replaceHelpS}
                </Typography>
              </>
            }
            sx={{ alignItems: "flex-start" }}
          />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onCancel}>
          {cancelS}
        </Button>
        <Button variant="contained" onClick={handleConfirm}>
          {applyS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
