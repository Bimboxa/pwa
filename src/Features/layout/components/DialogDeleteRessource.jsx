import { useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

export default function DialogDeleteRessource({
  open,
  onClose,
  onConfirmAsync,
  message,
  title: titleProp,
  confirmColor = "error",
}) {
  // `title` / `confirmColor` let a non-destructive batch action reuse the
  // dialog (e.g. merging overlapping openings).
  const title = titleProp ?? "Confirmer la suppression";
  const confirmS = "Confirmer";
  const cancelS = "Annuler";

  const confirmBtnRef = useRef(null);

  async function handleConfirm() {
    await onConfirmAsync();
  }

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        transition: {
          onEntered: () => confirmBtnRef.current?.focus(), // focus when transition completes
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>

      {message && (
        <DialogContent>
          <Typography variant="body2">{message}</Typography>
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          <Typography variant="body2">{cancelS}</Typography>
        </Button>

        <Button
          ref={confirmBtnRef}
          onClick={handleConfirm}
          color={confirmColor}
          variant="contained"
        >
          <Typography variant="body2">{confirmS}</Typography>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
