import { useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import useUpdateListing from "../hooks/useUpdateListing";

// Rename dialog of any listing. Goes through useUpdateListing (ownership
// guard + sync file), not a raw db.listings.update.
export default function DialogRenameListing({ open, listing, onClose }) {
  const updateListing = useUpdateListing();

  // strings

  const titleS = "Renommer la liste";
  const nameS = "Nom";
  const cancelS = "Annuler";
  const renameS = "Renommer";

  // state

  const [name, setName] = useState(listing?.name ?? "");

  // handlers

  async function handleRename() {
    await updateListing({ id: listing.id, name });
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={nameS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name) handleRename();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelS}</Button>
        <Button variant="contained" onClick={handleRename} disabled={!name}>
          {renameS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
