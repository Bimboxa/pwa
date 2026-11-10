import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

// Name dialog of a block: creation (« Nouveau bloc ») or rename.
export default function DialogBlockLabel({
  open,
  title,
  initialLabel = "",
  submitLabel,
  onClose,
  onSubmit,
}) {
  // strings

  const labelS = "Nom du bloc";
  const cancelS = "Annuler";

  // state

  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (open) setLabel(initialLabel);
  }, [open, initialLabel]);

  // helpers

  const canSubmit = label.trim().length > 0;

  // handlers

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(label.trim());
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            margin="dense"
            label={labelS}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{cancelS}</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
