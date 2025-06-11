import {
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

export default function DialogDeleteRessource({open, onClose, onConfirmAsync}) {
  // strings

  const title = "Confirmer la suppression";

  const confirmS = "Confirmer";
  const cancelS = "Annuler";
  // handlers

  async function handleConfirm() {
    await onConfirmAsync();
  }
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          <Typography variant="body2">{cancelS}</Typography>
        </Button>
        <Button onClick={handleConfirm} color="error" variant="contained">
          <Typography variant="body2">{confirmS}</Typography>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
