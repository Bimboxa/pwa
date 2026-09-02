import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedListingId } from "../businessObjectsSlice";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import useCreateBusinessObjectListing from "../hooks/useCreateBusinessObjectListing";

export default function DialogCreateBusinessObjectListing({ open, onClose }) {
  const dispatch = useDispatch();
  const createBusinessObjectListing = useCreateBusinessObjectListing();

  // state

  const [name, setName] = useState("");

  // handlers

  async function handleCreate() {
    const listing = await createBusinessObjectListing({ name });
    if (listing) dispatch(setSelectedListingId(listing.id));
    onClose();
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nouvelle liste d&apos;ouvrages</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name) handleCreate();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!name}>
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
