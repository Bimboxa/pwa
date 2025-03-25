import {Dialog, DialogTitle, DialogActions, Button} from "@mui/material";

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
          {cancelS}
        </Button>
        <Button onClick={handleConfirm} color="warning" variant="outlined">
          {confirmS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
