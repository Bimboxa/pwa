import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedPhotoListingId } from "../photosSlice";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import useCreatePhotoAlbum from "../hooks/useCreatePhotoAlbum";

export default function DialogCreatePhotoAlbum({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Nouvel album photos";
  const nameS = "Nom de l'album";
  const cancelS = "Annuler";
  const createS = "Créer";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createPhotoAlbum = useCreatePhotoAlbum();

  // state

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  // handlers

  async function handleCreate() {
    if (!projectId || creating) return;
    setCreating(true);
    try {
      const listing = await createPhotoAlbum({ projectId, name });
      dispatch(setSelectedPhotoListingId(listing.id));
      onClose();
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          variant="outlined"
          size="small"
          label={nameS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelS}</Button>
        <Button variant="contained" onClick={handleCreate} disabled={creating}>
          {createS}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
