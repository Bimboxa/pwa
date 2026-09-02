import { useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import db from "App/db/db";

export default function DialogRenameBusinessObjectListing({
  open,
  listing,
  onClose,
}) {
  // state

  const [name, setName] = useState(listing.name ?? "");

  // handlers

  async function handleRename() {
    await db.listings.update(listing.id, { name });
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Renommer la liste</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name) handleRename();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleRename} disabled={!name}>
          Renommer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
