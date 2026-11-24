import { useState } from "react";
import { useDispatch } from "react-redux";

import { triggerRelsPhaseAnnotationUpdate } from "../phasingSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

import useCreateBusinessObject from "Features/businessObjects/hooks/useCreateBusinessObject";

import applyNewPhaseActivationService from "../services/applyNewPhaseActivationService";

// Creation of a phase from the phases strip: appended after the last phase
// of the listing. `phases`: the current ordered phases.
export default function DialogCreatePhase({ open, onClose, listing, phases }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nouvelle phase";
  const nameS = "Nom";
  const activateS =
    "Activer cette phase pour les annotations actives de la phase précédente";
  const cancelS = "Annuler";
  const createS = "Créer";
  const errorS = "La phase n'a pas pu être créée.";

  // data

  const createBusinessObject = useCreateBusinessObject();

  // state

  const [name, setName] = useState(null);
  const [activate, setActivate] = useState(true);
  const [loading, setLoading] = useState(false);

  // helpers

  const defaultName = `Phase ${(phases?.length ?? 0) + 1}`;
  const label = (name ?? defaultName).trim();
  const hasPreviousPhase = (phases?.length ?? 0) > 0;

  // handlers

  function handleClose() {
    setName(null);
    setActivate(true);
    onClose();
  }

  async function handleCreate() {
    if (!label || !listing || loading) return;
    setLoading(true);
    try {
      const phase = await createBusinessObject({ listing, label, unit: null });
      if (hasPreviousPhase) {
        await applyNewPhaseActivationService({
          listing,
          phases: [...phases, phase],
          activate,
        });
        dispatch(triggerRelsPhaseAnnotationUpdate());
      }
      handleClose();
    } catch (e) {
      console.error("[DialogCreatePhase]", e);
      dispatch(setToaster({ message: e?.message || errorS, isError: true }));
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={nameS}
          value={name ?? defaultName}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          sx={{ mt: 1 }}
        />
        {hasPreviousPhase && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={activate}
                onChange={(e) => setActivate(e.target.checked)}
              />
            }
            label={<Typography variant="body2">{activateS}</Typography>}
            sx={{ mt: 1, ml: 0, alignItems: "flex-start" }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{cancelS}</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!label || loading}
        >
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
